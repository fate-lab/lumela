//! App-level settings the Rust side needs (the editor's own preferences live in the UI).

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    /// Start in the tray without showing the editor.
    pub hide_at_launch: bool,
    /// Hide the editor window before capturing so it is not in the screenshot.
    pub hide_editor_while_capturing: bool,
    /// Keep every capture in the history.
    pub keep_history: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self { hide_at_launch: false, hide_editor_while_capturing: true, keep_history: true }
    }
}

fn file<R: Runtime>(app: &AppHandle<R>) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

pub fn load<R: Runtime>(app: &AppHandle<R>) -> AppSettings {
    file(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save<R: Runtime>(app: &AppHandle<R>, s: &AppSettings) -> Result<(), String> {
    let p = file(app).ok_or("config dir unavailable")?;
    if let Some(d) = p.parent() {
        std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, serde_json::to_string_pretty(s).unwrap()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let s: AppSettings = serde_json::from_str(r#"{"hideAtLaunch":true}"#).unwrap();
        assert!(s.hide_at_launch);
        assert!(s.hide_editor_while_capturing);
        assert!(s.keep_history);
    }
}
