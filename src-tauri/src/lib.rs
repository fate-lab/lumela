mod capture;
mod export;
mod history;
mod ocr;
mod permissions;
mod redact;
mod settings;
mod shortcuts;

use std::sync::Mutex;
use std::time::Duration;

use image::RgbaImage;
use serde::{Deserialize, Serialize};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use capture::{Frozen, Rect, WindowInfo};
use shortcuts::{ShortcutError, Shortcuts};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureMode {
    Area,
    Window,
    Fullscreen,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageInfo {
    id: u64,
    width: u32,
    height: u32,
    /// area | window | fullscreen | file | clipboard | history
    source: String,
    /// History entry holding this image (and its editor state), if any.
    history_id: Option<String>,
}

struct Current {
    image: RgbaImage,
    info: ImageInfo,
}

#[derive(Default)]
struct AppState {
    frozen: Mutex<Option<(Frozen, CaptureMode)>>,
    current: Mutex<Option<Current>>,
    next_id: Mutex<u64>,
    main_was_visible: Mutex<bool>,
    shortcuts: Mutex<Shortcuts>,
    bindings: Mutex<Vec<(Shortcut, CaptureMode)>>,
    /// OCR of the current image: (image id, language, result).
    ocr_cache: Mutex<Option<(u64, String, ocr::OcrResult)>>,
    app_settings: Mutex<settings::AppSettings>,
}

fn history_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir().map(|d| d.join("history")).map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OverlayInfo {
    width: u32,
    height: u32,
    /// False on Wayland, where window positions are not available.
    window_mode: bool,
    mode: CaptureMode,
    windows: Vec<WindowInfo>,
}

fn show_editor(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Makes `image` the editor's image. New images (not reopened from history) are
/// written to the history in the background when history is enabled.
fn set_current(app: &AppHandle, image: RgbaImage, source: &str) -> ImageInfo {
    let keep = app.state::<AppState>().app_settings.lock().unwrap().keep_history;
    let history_id = keep.then(|| history::new_id(chrono::Utc::now().timestamp_millis(), next_id(app)));
    if let (Some(hid), Ok(root)) = (&history_id, history_root(app)) {
        let entry = history::Entry {
            id: hid.clone(),
            created: chrono::Utc::now().timestamp_millis(),
            source: source.into(),
            width: image.width(),
            height: image.height(),
        };
        let img = image.clone();
        std::thread::spawn(move || {
            if let Err(e) = history::save(&root, &entry, &img) {
                eprintln!("history save failed: {e}");
            }
            history::prune(&root, history::KEEP);
        });
    }
    set_current_with(app, image, source, history_id)
}

fn next_id(app: &AppHandle) -> u64 {
    let state = app.state::<AppState>();
    let mut n = state.next_id.lock().unwrap();
    *n += 1;
    *n
}

fn set_current_with(app: &AppHandle, image: RgbaImage, source: &str, history_id: Option<String>) -> ImageInfo {
    let state = app.state::<AppState>();
    let id = next_id(app);
    let info = ImageInfo { id, width: image.width(), height: image.height(), source: source.into(), history_id };
    *state.current.lock().unwrap() = Some(Current { image, info: info.clone() });
    let _ = app.emit_to("main", "image-loaded", info.clone());
    show_editor(app);
    info
}

fn begin_capture(app: &AppHandle, mode: CaptureMode) -> Result<(), String> {
    if app.get_webview_window("overlay").is_some() {
        return Ok(());
    }
    // macOS: without Screen Recording permission captures only contain the desktop.
    if permissions::status() == permissions::Status::Denied {
        permissions::request();
        show_editor(app);
        let _ = app.emit_to("main", "permission-needed", ());
        return Ok(());
    }
    let state = app.state::<AppState>();
    let main = app.get_webview_window("main");
    let was_visible = main.as_ref().and_then(|w| w.is_visible().ok()).unwrap_or(false);
    *state.main_was_visible.lock().unwrap() = was_visible;
    let hide = state.app_settings.lock().unwrap().hide_editor_while_capturing;
    if was_visible && hide {
        if let Some(w) = &main {
            let _ = w.hide();
        }
        // Give the compositor time to remove our window from the screen.
        std::thread::sleep(Duration::from_millis(250));
    }

    let (cx, cy) = app.cursor_position().map(|p| (p.x as i32, p.y as i32)).unwrap_or((0, 0));
    let frozen = match capture::freeze_monitor_at(cx, cy) {
        Ok(f) => f,
        Err(e) => {
            if was_visible {
                show_editor(app);
            }
            return Err(e);
        }
    };

    if mode == CaptureMode::Fullscreen {
        set_current(app, frozen.image, "fullscreen");
        return Ok(());
    }

    let (ox, oy) = frozen.origin;
    let (w, h) = frozen.image.dimensions();
    *state.frozen.lock().unwrap() = Some((frozen, mode));

    let url = WebviewUrl::App("index.html?view=overlay".into());
    let win = WebviewWindowBuilder::new(app, "overlay", url)
        .title("Capture")
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    if capture::is_wayland() {
        // Wayland does not let clients place windows; cover the output instead.
        let _ = win.set_fullscreen(true);
    } else {
        let _ = win.set_position(PhysicalPosition::new(ox, oy));
        let _ = win.set_size(PhysicalSize::new(w, h));
    }
    // The overlay page shows and focuses itself after its first paint.
    Ok(())
}

fn spawn_capture(app: &AppHandle, mode: CaptureMode) {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(e) = begin_capture(&app, mode) {
            let _ = app.emit_to("main", "app-error", e);
        }
    });
}

fn close_overlay(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.destroy();
    }
}

// ---------------------------------------------------------------- commands

#[tauri::command]
async fn start_capture(app: AppHandle, mode: CaptureMode) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || begin_capture(&app, mode))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn overlay_info(state: tauri::State<AppState>) -> Result<OverlayInfo, String> {
    let guard = state.frozen.lock().unwrap();
    let (f, mode) = guard.as_ref().ok_or("no capture in progress")?;
    Ok(OverlayInfo {
        width: f.image.width(),
        height: f.image.height(),
        window_mode: !capture::is_wayland(),
        mode: *mode,
        windows: f.windows.clone(),
    })
}

#[tauri::command]
fn overlay_pixels(state: tauri::State<AppState>) -> Result<Response, String> {
    let guard = state.frozen.lock().unwrap();
    let (f, _) = guard.as_ref().ok_or("no capture in progress")?;
    Ok(Response::new(f.image.as_raw().clone()))
}

#[tauri::command]
fn finish_capture(app: AppHandle, rect: Rect, window: bool) -> Result<(), String> {
    let taken = app.state::<AppState>().frozen.lock().unwrap().take();
    close_overlay(&app);
    let (f, _) = taken.ok_or("no capture in progress")?;
    let img = capture::crop(&f.image, rect).ok_or("empty selection")?;
    set_current(&app, img, if window { "window" } else { "area" });
    Ok(())
}

#[tauri::command]
fn cancel_capture(app: AppHandle) {
    let state = app.state::<AppState>();
    state.frozen.lock().unwrap().take();
    close_overlay(&app);
    if *state.main_was_visible.lock().unwrap() {
        show_editor(&app);
    }
}

#[tauri::command]
fn current_info(state: tauri::State<AppState>) -> Option<ImageInfo> {
    state.current.lock().unwrap().as_ref().map(|c| c.info.clone())
}

#[tauri::command]
fn current_pixels(state: tauri::State<AppState>) -> Result<Response, String> {
    let guard = state.current.lock().unwrap();
    let c = guard.as_ref().ok_or("no image")?;
    Ok(Response::new(c.image.as_raw().clone()))
}

/// OCR of the current image (cached per image and language). Boxes are in image pixels.
fn ocr_current_blocking(app: &AppHandle, language: &str) -> Result<ocr::OcrResult, String> {
    let state = app.state::<AppState>();
    let (id, image) = {
        let guard = state.current.lock().unwrap();
        let c = guard.as_ref().ok_or("no image")?;
        (c.info.id, c.image.clone())
    };
    if let Some((cid, lang, r)) = state.ocr_cache.lock().unwrap().as_ref()
        && *cid == id && lang == language {
            return Ok(r.clone());
        }
    let result = ocr::engine().recognize(&image, Some(language))?;
    *state.ocr_cache.lock().unwrap() = Some((id, language.to_string(), result.clone()));
    Ok(result)
}

#[tauri::command]
async fn ocr_current(app: AppHandle, language: Option<String>) -> Result<ocr::OcrResult, String> {
    let lang = language.unwrap_or_default();
    tauri::async_runtime::spawn_blocking(move || ocr_current_blocking(&app, &lang))
        .await
        .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------- history

#[tauri::command]
async fn history_list(app: AppHandle) -> Result<Vec<history::Entry>, String> {
    let root = history_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || history::list(&root)).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn history_thumb(app: AppHandle, id: String) -> Result<Response, String> {
    let root = history_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || history::thumb(&root, &id))
        .await
        .map_err(|e| e.to_string())?
        .map(Response::new)
}

#[tauri::command]
async fn history_open(app: AppHandle, id: String) -> Result<ImageInfo, String> {
    let root = history_root(&app)?;
    let rid = id.clone();
    let img = tauri::async_runtime::spawn_blocking(move || history::load(&root, &rid))
        .await
        .map_err(|e| e.to_string())??;
    Ok(set_current_with(&app, img, "history", Some(id)))
}

#[tauri::command]
fn history_get_state(app: AppHandle, id: String) -> Result<Option<String>, String> {
    history::get_state(&history_root(&app)?, &id)
}

#[tauri::command]
fn history_put_state(app: AppHandle, id: String, state: String) -> Result<(), String> {
    history::put_state(&history_root(&app)?, &id, &state)
}

#[tauri::command]
fn history_delete(app: AppHandle, id: String) -> Result<(), String> {
    history::delete(&history_root(&app)?, &id)
}

// ---------------------------------------------------------------- settings

#[tauri::command]
fn get_app_settings(state: tauri::State<AppState>) -> settings::AppSettings {
    state.app_settings.lock().unwrap().clone()
}

#[tauri::command]
fn set_app_settings(app: AppHandle, value: settings::AppSettings) -> Result<(), String> {
    settings::save(&app, &value)?;
    *app.state::<AppState>().app_settings.lock().unwrap() = value;
    Ok(())
}

fn open_settings_window(app: &AppHandle, tab: Option<&str>) -> Result<(), String> {
    let tab = tab.filter(|t| t.chars().all(|c| c.is_ascii_lowercase()));
    if let Some(w) = app.get_webview_window("settings") {
        if let Some(t) = tab {
            let _ = app.emit_to("settings", "settings-tab", t);
        }
        let _ = w.unminimize();
        let _ = w.show();
        return w.set_focus().map_err(|e| e.to_string());
    }
    let url = match tab {
        Some(t) => format!("index.html?view=settings&tab={t}"),
        None => "index.html?view=settings".into(),
    };
    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App(url.into()))
        .title("Lumela Settings")
        .inner_size(760.0, 620.0)
        .min_inner_size(640.0, 480.0)
        .center()
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Async on purpose: synchronous commands run on the main thread, and building a
/// webview window there deadlocks on Windows (white window, frozen app).
#[tauri::command]
async fn open_settings(app: AppHandle, tab: Option<String>) -> Result<(), String> {
    open_settings_window(&app, tab.as_deref())
}

#[tauri::command]
fn screen_permission() -> permissions::Status {
    permissions::status()
}

#[tauri::command]
fn open_permission_settings(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(permissions::SETTINGS_URL, None::<&str>).map_err(|e| e.to_string())
}

/// macOS applies a newly granted Screen Recording permission only after a restart.
#[tauri::command]
fn restart_app(app: AppHandle) {
    app.restart();
}

/// Whether the built-in updater can replace this install. On Linux it can only swap an
/// AppImage (which sets `APPIMAGE`); `.deb`/`.rpm` installs are updated by reinstalling.
fn self_update_supported_for(os: &str, appimage: Option<&str>) -> bool {
    os != "linux" || appimage.is_some_and(|p| !p.is_empty())
}

#[tauri::command]
fn self_update_supported() -> bool {
    self_update_supported_for(std::env::consts::OS, std::env::var("APPIMAGE").ok().as_deref())
}

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    arboard::Clipboard::new().and_then(|mut c| c.set_text(text)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ocr_languages() -> Result<Vec<ocr::OcrLanguage>, String> {
    tauri::async_runtime::spawn_blocking(|| ocr::engine().languages()).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn detect_sensitive(
    app: AppHandle,
    categories: redact::Categories,
    language: Option<String>,
) -> Result<Vec<redact::Hit>, String> {
    let lang = language.unwrap_or_default();
    let result = tauri::async_runtime::spawn_blocking(move || ocr_current_blocking(&app, &lang))
        .await
        .map_err(|e| e.to_string())??;
    Ok(redact::detect(&result, categories))
}

#[tauri::command]
async fn load_image_file(app: AppHandle, path: String) -> Result<ImageInfo, String> {
    let img = tauri::async_runtime::spawn_blocking(move || image::open(&path).map(|i| i.to_rgba8()))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| format!("Could not open the image: {e}"))?;
    Ok(set_current(&app, img, "file"))
}

#[tauri::command]
fn load_clipboard_image(app: AppHandle) -> Result<ImageInfo, String> {
    let img = export::read_clipboard()?;
    Ok(set_current(&app, img, "clipboard"))
}

fn header<'a>(req: &'a Request, name: &str) -> Result<&'a str, String> {
    req.headers()
        .get(name)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| format!("missing header {name}"))
}

fn raw_body<'a>(req: &'a Request) -> Result<&'a [u8], String> {
    match req.body() {
        InvokeBody::Raw(b) => Ok(b),
        _ => Err("expected raw body".into()),
    }
}

/// Body: RGBA pixels. Headers: width, height.
#[tauri::command]
fn copy_rgba(request: Request) -> Result<(), String> {
    let w: u32 = header(&request, "width")?.parse().map_err(|_| "bad width")?;
    let h: u32 = header(&request, "height")?.parse().map_err(|_| "bad height")?;
    let img = RgbaImage::from_raw(w, h, raw_body(&request)?.to_vec()).ok_or("size mismatch")?;
    export::copy_to_clipboard(&img)
}

/// Body: encoded file bytes. Headers: path (URI-encoded) or, when empty, template + ext
/// for an automatic name in `dir` (default folder when empty); compress=1 runs a
/// lossless PNG optimisation first. Returns the written path.
#[tauri::command]
async fn save_bytes(request: Request<'_>) -> Result<String, String> {
    let decode = |s: &str| urlencoding_decode(s);
    let path = decode(header(&request, "path").unwrap_or(""));
    let dir = decode(header(&request, "dir").unwrap_or(""));
    let template = decode(header(&request, "template").unwrap_or(""));
    let ext = header(&request, "ext").unwrap_or("png").to_string();
    let compress = header(&request, "compress").unwrap_or("") == "1";
    let body = raw_body(&request)?.to_vec();

    tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let target = if path.is_empty() {
            let dir = if dir.is_empty() { export::default_save_dir() } else { dir.into() };
            std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            export::unique_path(&dir, &export::file_name(&template, chrono::Local::now(), &ext))
        } else {
            let p = std::path::PathBuf::from(path);
            if let Some(parent) = p.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            p
        };
        let is_png = target.extension().is_some_and(|e| e.eq_ignore_ascii_case("png"));
        let bytes = if compress && is_png { export::compress_png(&body) } else { body };
        std::fs::write(&target, bytes).map_err(|e| e.to_string())?;
        Ok(target.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn default_save_dir() -> String {
    export::default_save_dir().to_string_lossy().into_owned()
}

/// Raw bytes of a local file (background images).
#[tauri::command]
async fn read_file_bytes(path: String) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || std::fs::read(&path))
        .await
        .map_err(|e| e.to_string())?
        .map(Response::new)
        .map_err(|e| format!("Could not read the file: {e}"))
}

#[tauri::command]
fn wallpaper_path() -> Result<String, String> {
    let p = wallpaper::get().map_err(|e| format!("Wallpaper not found: {e}"))?;
    if p.trim().is_empty() || !std::path::Path::new(&p).exists() {
        return Err("Wallpaper not found (it may be a solid colour or a slideshow)".into());
    }
    Ok(p)
}

#[tauri::command]
fn get_shortcuts(state: tauri::State<AppState>) -> Shortcuts {
    state.shortcuts.lock().unwrap().clone()
}

/// Validates, registers and persists new shortcuts. On any error the previous
/// set stays active and the errors are returned.
#[tauri::command]
fn set_shortcuts(app: AppHandle, shortcuts: Shortcuts) -> Result<(), Vec<ShortcutError>> {
    let state = app.state::<AppState>();
    let parsed = shortcuts.parse()?;
    let failed = shortcuts::register(&app, &parsed);
    if !failed.is_empty() {
        let previous = state.bindings.lock().unwrap().clone();
        shortcuts::register(&app, &previous);
        return Err(failed);
    }
    *state.bindings.lock().unwrap() = parsed;
    *state.shortcuts.lock().unwrap() = shortcuts.clone();
    let _ = shortcuts::save(&app, &shortcuts);
    refresh_tray_menu(&app);
    Ok(())
}

/// Turns global shortcuts off while the recorder listens for a new combination.
#[tauri::command]
fn suspend_shortcuts(app: AppHandle, suspend: bool) {
    if suspend {
        let _ = app.global_shortcut().unregister_all();
    } else {
        let bindings = app.state::<AppState>().bindings.lock().unwrap().clone();
        shortcuts::register(&app, &bindings);
    }
}

fn urlencoding_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len()
            && let Some(v) = std::str::from_utf8(&bytes[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(v);
                i += 3;
                continue;
            }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

// ---------------------------------------------------------------- setup

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let sc = app.state::<AppState>().shortcuts.lock().unwrap().clone();
    let item = |id: &str, text: &str, accel: Option<&str>| MenuItem::with_id(app, id, text, true, accel);
    // An accelerator the menu cannot parse should not break the whole menu.
    let capture_item = |id: &str, text: &str, accel: &str| {
        item(id, text, Some(&shortcuts::display(accel))).or_else(|_| item(id, text, None))
    };
    Menu::with_items(
        app,
        &[
            &capture_item("area", "Capture area", &sc.area)?,
            &capture_item("window", "Capture window", &sc.window)?,
            &capture_item("fullscreen", "Capture full screen", &sc.fullscreen)?,
            &PredefinedMenuItem::separator(app)?,
            &item("open", "Open file…", None)?,
            &item("clipboard", "Open from clipboard", None)?,
            &item("show", "Show editor", None)?,
            &item("history", "History", None)?,
            &item("settings", "Settings…", None)?,
            &PredefinedMenuItem::separator(app)?,
            &item("quit", "Quit", None)?,
        ],
    )
}

fn refresh_tray_menu(app: &AppHandle) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id("main"), build_menu(app)) {
        let _ = tray.set_menu(Some(menu));
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    TrayIconBuilder::with_id("main")
        // Small-size variant of the logo (bolder glyph, no margin) reads better at 16–32 px.
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .tooltip("Lumela")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, ev| match ev.id().as_ref() {
            "area" => spawn_capture(app, CaptureMode::Area),
            "window" => spawn_capture(app, CaptureMode::Window),
            "fullscreen" => spawn_capture(app, CaptureMode::Fullscreen),
            "open" => {
                show_editor(app);
                let _ = app.emit_to("main", "menu-open-file", ());
            }
            "clipboard" => {
                if let Err(e) = load_clipboard_image(app.clone()) {
                    show_editor(app);
                    let _ = app.emit_to("main", "app-error", e);
                }
            }
            "show" => show_editor(app),
            "history" => {
                show_editor(app);
                let _ = app.emit_to("main", "menu-history", ());
            }
            "settings" => {
                let _ = open_settings_window(app, None);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                show_editor(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            let mode = app
                .state::<AppState>()
                .bindings
                .lock()
                .unwrap()
                .iter()
                .find(|(s, _)| s.id() == shortcut.id())
                .map(|(_, m)| *m);
            if let Some(mode) = mode {
                spawn_capture(app, mode);
            }
        })
        .build();

    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(shortcut_plugin)
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--background"])))
        .setup(|app| {
            let handle = app.handle();
            let state = handle.state::<AppState>();
            let mut sc = shortcuts::load(handle);
            let parsed = match sc.parse() {
                Ok(p) => p,
                Err(_) => {
                    sc = Shortcuts::default();
                    sc.parse().expect("default shortcuts parse")
                }
            };
            for e in shortcuts::register(handle, &parsed) {
                eprintln!("shortcut {:?} not registered: {}", e.action, e.message);
            }
            *state.bindings.lock().unwrap() = parsed;
            *state.shortcuts.lock().unwrap() = sc;
            build_tray(handle)?;

            // The editor starts hidden (see tauri.conf.json) and is shown unless the
            // user prefers starting in the tray or we were launched at login.
            let app_settings = settings::load(handle);
            let background = app_settings.hide_at_launch || std::env::args().any(|a| a == "--background");
            *state.app_settings.lock().unwrap() = app_settings;
            if !background {
                show_editor(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the editor keeps the app alive in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
        })
        .invoke_handler(tauri::generate_handler![
            start_capture,
            overlay_info,
            overlay_pixels,
            finish_capture,
            cancel_capture,
            current_info,
            current_pixels,
            load_image_file,
            load_clipboard_image,
            copy_rgba,
            save_bytes,
            default_save_dir,
            read_file_bytes,
            wallpaper_path,
            get_shortcuts,
            set_shortcuts,
            suspend_shortcuts,
            ocr_current,
            ocr_languages,
            detect_sensitive,
            copy_text,
            history_list,
            history_thumb,
            history_open,
            history_get_state,
            history_put_state,
            history_delete,
            get_app_settings,
            set_app_settings,
            open_settings,
            screen_permission,
            open_permission_settings,
            restart_app,
            self_update_supported,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_percent_encoding() {
        assert_eq!(urlencoding_decode("C%3A%5CUsers%5C%C3%BCmit%20a.png"), "C:\\Users\\ümit a.png");
        assert_eq!(urlencoding_decode("plain"), "plain");
        assert_eq!(urlencoding_decode("bad%zz%4"), "bad%zz%4");
    }

    #[test]
    fn only_appimage_self_updates_on_linux() {
        assert!(self_update_supported_for("windows", None));
        assert!(self_update_supported_for("macos", None));
        assert!(self_update_supported_for("linux", Some("/home/u/Lumela.AppImage")));
        assert!(!self_update_supported_for("linux", None));
        assert!(!self_update_supported_for("linux", Some("")));
    }
}
