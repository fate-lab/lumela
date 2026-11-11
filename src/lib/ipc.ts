import { invoke } from "@tauri-apps/api/core";

export type CaptureMode = "area" | "window" | "fullscreen";
export type ImageSource = CaptureMode | "file" | "clipboard" | "history";

export interface ImageInfo { id: number; width: number; height: number; source: ImageSource; historyId: string | null }

export interface HistoryEntry { id: string; created: number; source: ImageSource; width: number; height: number }
export const historyList = () => invoke<HistoryEntry[]>("history_list");
export const historyOpen = (id: string) => invoke<ImageInfo>("history_open", { id });
export const historyGetState = (id: string) => invoke<string | null>("history_get_state", { id });
export const historyPutState = (id: string, state: string) => invoke<void>("history_put_state", { id, state });
export const historyDelete = (id: string) => invoke<void>("history_delete", { id });
export async function historyThumbUrl(id: string): Promise<string> {
  const buf = await invoke<ArrayBuffer>("history_thumb", { id });
  return URL.createObjectURL(new Blob([buf], { type: "image/png" }));
}

export interface AppSettings { hideAtLaunch: boolean; hideEditorWhileCapturing: boolean; keepHistory: boolean }
export const getAppSettings = () => invoke<AppSettings>("get_app_settings");
export const setAppSettings = (value: AppSettings) => invoke<void>("set_app_settings", { value });
export const openSettings = (tab?: string) => invoke<void>("open_settings", { tab: tab ?? null });
export interface Rect { x: number; y: number; width: number; height: number }
export interface WindowInfo { rect: Rect; title: string; app: string }
export interface OverlayInfo { width: number; height: number; windowMode: boolean; mode: CaptureMode; windows: WindowInfo[] }

export type PermissionStatus = "granted" | "denied" | "unsupported";
export const screenPermission = () => invoke<PermissionStatus>("screen_permission");
export const openPermissionSettings = () => invoke<void>("open_permission_settings");
export const restartApp = () => invoke<void>("restart_app");
export const selfUpdateSupported = () => invoke<boolean>("self_update_supported");

export const startCapture = (mode: CaptureMode) => invoke<void>("start_capture", { mode });
export const overlayInfo = () => invoke<OverlayInfo>("overlay_info");
export const finishCapture = (rect: Rect, window: boolean) => invoke<void>("finish_capture", { rect, window });
export const cancelCapture = () => invoke<void>("cancel_capture");
export const currentInfo = () => invoke<ImageInfo | null>("current_info");
export const loadImageFile = (path: string) => invoke<ImageInfo>("load_image_file", { path });
export const loadClipboardImage = () => invoke<ImageInfo>("load_clipboard_image");
export const defaultSaveDir = () => invoke<string>("default_save_dir");
export const wallpaperPath = () => invoke<string>("wallpaper_path");

/** Decodes a local image file (any format the webview understands). */
export async function readImageFile(path: string): Promise<ImageBitmap> {
  const buf = await invoke<ArrayBuffer>("read_file_bytes", { path });
  return createImageBitmap(new Blob([buf]));
}

export interface OcrWord { text: string; x: number; y: number; w: number; h: number }
export interface OcrLine { text: string; words: OcrWord[] }
export interface OcrResult { lines: OcrLine[] }
export interface OcrLanguage { tag: string; name: string }
export interface RedactCategories { emails: boolean; creditCards: boolean; ipAddresses: boolean; apiKeys: boolean }
export interface SensitiveHit { category: "email" | "credit-card" | "ip-address" | "api-key"; x: number; y: number; w: number; h: number }

export const ocrCurrent = (language: string) => invoke<OcrResult>("ocr_current", { language });
export const ocrLanguages = () => invoke<OcrLanguage[]>("ocr_languages");
export const detectSensitive = (categories: RedactCategories, language: string) =>
  invoke<SensitiveHit[]>("detect_sensitive", { categories, language });
export const copyText = (text: string) => invoke<void>("copy_text", { text });

export interface Shortcuts { area: string; window: string; fullscreen: string }
export interface ShortcutError { action: keyof Shortcuts; message: string }
export const getShortcuts = () => invoke<Shortcuts>("get_shortcuts");
/** Rejects with ShortcutError[] when a shortcut is invalid, duplicated or taken by another app. */
export const setShortcuts = (shortcuts: Shortcuts) => invoke<void>("set_shortcuts", { shortcuts });
export const suspendShortcuts = (suspend: boolean) => invoke<void>("suspend_shortcuts", { suspend });

async function pixels(cmd: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const buf = await invoke<ArrayBuffer>(cmd);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(buf), w, h), 0, 0);
  return canvas;
}

export const overlayPixels = (w: number, h: number) => pixels("overlay_pixels", w, h);
export const currentPixels = (w: number, h: number) => pixels("current_pixels", w, h);

export async function copyCanvas(canvas: HTMLCanvasElement) {
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  await invoke("copy_rgba", new Uint8Array(data.buffer), {
    headers: { width: String(canvas.width), height: String(canvas.height) },
  });
}

export type ExportFormat = "png" | "jpeg";

function encode(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error("encode failed"))),
      format === "png" ? "image/png" : "image/jpeg",
      0.92,
    ),
  );
}

/** Saves to `path`, or to an auto-named file in `dir` (default folder when empty). */
export async function saveCanvas(
  canvas: HTMLCanvasElement,
  opts: { path?: string; dir?: string; template?: string; format: ExportFormat; compress?: boolean },
): Promise<string> {
  const bytes = await encode(canvas, opts.format);
  return invoke<string>("save_bytes", bytes, {
    headers: {
      path: encodeURIComponent(opts.path ?? ""),
      dir: encodeURIComponent(opts.dir ?? ""),
      template: encodeURIComponent(opts.template ?? ""),
      ext: opts.format === "png" ? "png" : "jpg",
      compress: opts.compress ? "1" : "0",
    },
  });
}
