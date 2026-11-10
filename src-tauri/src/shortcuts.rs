//! User-configurable global shortcuts, persisted as JSON in the app config dir.

use std::path::PathBuf;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

use crate::CaptureMode;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Shortcuts {
    pub area: String,
    pub window: String,
    pub fullscreen: String,
}

impl Default for Shortcuts {
    fn default() -> Self {
        Self {
            area: "ctrl+shift+Digit2".into(),
            window: "ctrl+shift+Digit3".into(),
            fullscreen: "ctrl+shift+Digit1".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ShortcutError {
    pub action: CaptureMode,
    pub message: String,
}

impl Shortcuts {
    pub fn entries(&self) -> [(CaptureMode, &str); 3] {
        [
            (CaptureMode::Area, self.area.as_str()),
            (CaptureMode::Window, self.window.as_str()),
            (CaptureMode::Fullscreen, self.fullscreen.as_str()),
        ]
    }

    /// Parses every entry; reports unparsable and duplicate shortcuts.
    pub fn parse(&self) -> Result<Vec<(Shortcut, CaptureMode)>, Vec<ShortcutError>> {
        let mut out: Vec<(Shortcut, CaptureMode)> = Vec::new();
        let mut errors = Vec::new();
        for (action, text) in self.entries() {
            match Shortcut::from_str(text) {
                Ok(s) if out.iter().any(|(o, _)| o.id() == s.id()) => {
                    errors.push(ShortcutError { action, message: "Another action already uses this shortcut".into() })
                }
                Ok(s) => out.push((s, action)),
                Err(e) => errors.push(ShortcutError { action, message: format!("Invalid shortcut: {e}") }),
            }
        }
        if errors.is_empty() { Ok(out) } else { Err(errors) }
    }
}

fn file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("shortcuts.json"))
}

pub fn load<R: Runtime>(app: &AppHandle<R>) -> Shortcuts {
    file(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save<R: Runtime>(app: &AppHandle<R>, s: &Shortcuts) -> Result<(), String> {
    let p = file(app).ok_or("config dir unavailable")?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, serde_json::to_string_pretty(s).unwrap()).map_err(|e| e.to_string())
}

/// Unregisters everything and registers `parsed`. Returns the actions the OS refused
/// (usually because another application owns that shortcut).
pub fn register<R: Runtime>(app: &AppHandle<R>, parsed: &[(Shortcut, CaptureMode)]) -> Vec<ShortcutError> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    parsed
        .iter()
        .filter_map(|(s, action)| {
            gs.register(*s).err().map(|e| ShortcutError {
                action: *action,
                message: format!("The system refused this shortcut; another app may be using it ({e})"),
            })
        })
        .collect()
}

/// Human readable form for menus: "ctrl+shift+Digit2" -> "Ctrl+Shift+2".
pub fn display(text: &str) -> String {
    text.split('+')
        .map(|part| {
            let p = part.trim();
            match p.to_ascii_lowercase().as_str() {
                "ctrl" | "control" => "Ctrl".to_string(),
                "shift" => "Shift".into(),
                "alt" | "option" => "Alt".into(),
                "super" | "cmd" | "command" | "meta" => "Super".into(),
                _ => p.strip_prefix("Digit").or_else(|| p.strip_prefix("Key")).unwrap_or(p).to_string(),
            }
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_parse() {
        assert_eq!(Shortcuts::default().parse().unwrap().len(), 3);
    }

    #[test]
    fn duplicates_and_garbage_are_reported() {
        let s = Shortcuts { area: "ctrl+KeyA".into(), window: "ctrl+KeyA".into(), fullscreen: "ctrl+nope".into() };
        let errs = s.parse().unwrap_err();
        assert_eq!(errs.len(), 2);
        assert_eq!(errs[0].action, CaptureMode::Window);
        assert_eq!(errs[1].action, CaptureMode::Fullscreen);
    }

    #[test]
    fn display_is_readable() {
        assert_eq!(display("ctrl+shift+Digit2"), "Ctrl+Shift+2");
        assert_eq!(display("alt+KeyS"), "Alt+S");
        assert_eq!(display("super+F5"), "Super+F5");
    }
}
