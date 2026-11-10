//! Screen capture: freezes the monitor under the cursor and lists the windows on it,
//! so the overlay can offer area and window selection on a still image.

use image::RgbaImage;
use serde::{Deserialize, Serialize};
use xcap::{Monitor, Window};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    /// Intersect with `[0, w) x [0, h)`. Returns `None` when nothing is left.
    pub fn clip(self, w: u32, h: u32) -> Option<Rect> {
        let x0 = self.x.max(0);
        let y0 = self.y.max(0);
        let x1 = (self.x + self.width as i32).min(w as i32);
        let y1 = (self.y + self.height as i32).min(h as i32);
        if x1 <= x0 || y1 <= y0 {
            return None;
        }
        Some(Rect { x: x0, y: y0, width: (x1 - x0) as u32, height: (y1 - y0) as u32 })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub rect: Rect,
    pub title: String,
    pub app: String,
}

/// Wayland sessions capture through the xdg-desktop-portal and expose neither
/// global window positions nor stacking order, so window mode is unavailable.
pub fn is_wayland() -> bool {
    cfg!(target_os = "linux") && session_is_wayland(std::env::var("XDG_SESSION_TYPE").ok(), std::env::var("WAYLAND_DISPLAY").ok())
}

fn session_is_wayland(session_type: Option<String>, wayland_display: Option<String>) -> bool {
    session_type.is_some_and(|s| s.eq_ignore_ascii_case("wayland")) || wayland_display.is_some_and(|d| !d.is_empty())
}

pub struct Frozen {
    pub image: RgbaImage,
    pub origin: (i32, i32),
    /// Windows on this monitor, topmost first, in image pixel coordinates.
    pub windows: Vec<WindowInfo>,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn monitor_at(x: i32, y: i32) -> Result<Monitor, String> {
    if let Ok(m) = Monitor::from_point(x, y) {
        return Ok(m);
    }
    let all = Monitor::all().map_err(err)?;
    all.iter()
        .position(|m| m.is_primary().unwrap_or(false))
        .or(if all.is_empty() { None } else { Some(0) })
        .map(|i| all.into_iter().nth(i).unwrap())
        .ok_or_else(|| "no monitor found".to_string())
}

pub fn freeze_monitor_at(x: i32, y: i32) -> Result<Frozen, String> {
    let monitor = monitor_at(x, y)?;
    let image = monitor.capture_image().map_err(err)?;
    let origin = (monitor.x().map_err(err)?, monitor.y().map_err(err)?);
    let windows = if is_wayland() { Vec::new() } else { list_windows(origin, image.width(), image.height()) };
    Ok(Frozen { image, origin, windows })
}

fn list_windows(origin: (i32, i32), w: u32, h: u32) -> Vec<WindowInfo> {
    let own = std::process::id();
    Window::all()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|win| {
            if win.is_minimized().unwrap_or(true) || win.pid().ok()? == own {
                return None;
            }
            let rect = Rect {
                x: win.x().ok()? - origin.0,
                y: win.y().ok()? - origin.1,
                width: win.width().ok()?,
                height: win.height().ok()?,
            }
            .clip(w, h)?;
            if rect.width < 8 || rect.height < 8 {
                return None;
            }
            Some(WindowInfo {
                rect,
                title: win.title().unwrap_or_default(),
                app: win.app_name().unwrap_or_default(),
            })
        })
        .collect()
}

pub fn crop(image: &RgbaImage, rect: Rect) -> Option<RgbaImage> {
    let r = rect.clip(image.width(), image.height())?;
    Some(image::imageops::crop_imm(image, r.x as u32, r.y as u32, r.width, r.height).to_image())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clip_inside_is_unchanged() {
        let r = Rect { x: 10, y: 10, width: 20, height: 20 };
        assert_eq!(r.clip(100, 100), Some(r));
    }

    #[test]
    fn clip_trims_negative_and_overflow() {
        let r = Rect { x: -5, y: 90, width: 20, height: 20 };
        assert_eq!(r.clip(100, 100), Some(Rect { x: 0, y: 90, width: 15, height: 10 }));
    }

    #[test]
    fn clip_outside_is_none() {
        assert_eq!(Rect { x: 200, y: 0, width: 5, height: 5 }.clip(100, 100), None);
    }

    #[test]
    fn wayland_session_detection() {
        assert!(session_is_wayland(Some("wayland".into()), None));
        assert!(session_is_wayland(None, Some("wayland-0".into())));
        assert!(!session_is_wayland(Some("x11".into()), Some(String::new())));
        assert!(!session_is_wayland(None, None));
    }

    #[test]
    fn crop_returns_region() {
        let mut img = RgbaImage::new(4, 4);
        img.put_pixel(2, 1, image::Rgba([255, 0, 0, 255]));
        let out = crop(&img, Rect { x: 2, y: 1, width: 2, height: 2 }).unwrap();
        assert_eq!(out.dimensions(), (2, 2));
        assert_eq!(out.get_pixel(0, 0).0, [255, 0, 0, 255]);
    }
}
