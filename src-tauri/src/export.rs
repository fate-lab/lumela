//! Output: clipboard, file naming and saving.

use std::path::{Path, PathBuf};

use chrono::{DateTime, Local};
use image::RgbaImage;

pub fn copy_to_clipboard(image: &RgbaImage) -> Result<(), String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_image(arboard::ImageData {
        width: image.width() as usize,
        height: image.height() as usize,
        bytes: std::borrow::Cow::Borrowed(image.as_raw()),
    })
    .map_err(|e| e.to_string())
}

pub fn read_clipboard() -> Result<RgbaImage, String> {
    let mut cb = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let data = cb.get_image().map_err(|_| "There is no image on the clipboard".to_string())?;
    RgbaImage::from_raw(data.width as u32, data.height as u32, data.bytes.into_owned())
        .ok_or_else(|| "Could not read the clipboard image".to_string())
}

/// Lossless PNG optimisation (oxipng preset 2: good size win, fast enough for 4K).
/// Falls back to the input if optimisation fails or does not help.
pub fn compress_png(png: &[u8]) -> Vec<u8> {
    match oxipng::optimize_from_memory(png, &oxipng::Options::from_preset(2)) {
        Ok(out) if out.len() < png.len() => out,
        _ => png.to_vec(),
    }
}


pub fn default_save_dir() -> PathBuf {
    dirs::picture_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(std::env::temp_dir)
        .join("Lumela")
}

/// Expands `{date}` and `{time}` in a file name template and appends the extension.
pub fn file_name(template: &str, now: DateTime<Local>, ext: &str) -> String {
    let t = if template.trim().is_empty() { "Lumela {date} at {time}" } else { template };
    let name = t
        .replace("{date}", &now.format("%Y-%m-%d").to_string())
        .replace("{time}", &now.format("%H.%M.%S").to_string());
    let safe: String = name
        .chars()
        .map(|c| if matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') { '-' } else { c })
        .collect();
    format!("{}.{}", safe.trim(), ext)
}

/// Returns `dir/name`, or `dir/stem (n).ext` if that file already exists.
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let p = Path::new(name);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("png");
    (1..)
        .map(|n| dir.join(format!("{stem} ({n}).{ext}")))
        .find(|c| !c.exists())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use image::ImageEncoder;

    #[test]
    fn file_name_expands_template() {
        let now = Local.with_ymd_and_hms(2026, 11, 10, 9, 5, 7).unwrap();
        assert_eq!(file_name("Shot {date} {time}", now, "png"), "Shot 2026-11-10 09.05.07.png");
        assert_eq!(file_name("", now, "jpg"), "Lumela 2026-11-10 at 09.05.07.jpg");
        assert_eq!(file_name("a:b?", now, "png"), "a-b-.png");
    }

    #[test]
    fn compress_png_shrinks_and_keeps_pixels() {
        // A flat image saved without compression effort has lots of room to shrink.
        let img = image::RgbaImage::from_pixel(300, 200, image::Rgba([40, 120, 200, 255]));
        let mut raw = Vec::new();
        image::codecs::png::PngEncoder::new_with_quality(
            &mut raw,
            image::codecs::png::CompressionType::Fast,
            image::codecs::png::FilterType::NoFilter,
        )
        .write_image(img.as_raw(), 300, 200, image::ExtendedColorType::Rgba8)
        .unwrap();
        let out = compress_png(&raw);
        assert!(out.len() < raw.len(), "{} >= {}", out.len(), raw.len());
        let decoded = image::load_from_memory(&out).unwrap().to_rgba8();
        assert_eq!(decoded, img);
    }

    #[test]
    fn compress_png_returns_input_on_garbage() {
        assert_eq!(compress_png(b"not a png"), b"not a png".to_vec());
    }

    #[test]
    fn unique_path_appends_counter() {
        let dir = std::env::temp_dir().join(format!("lml-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("x.png"), b"1").unwrap();
        std::fs::write(dir.join("x (1).png"), b"1").unwrap();
        assert_eq!(unique_path(&dir, "x.png"), dir.join("x (2).png"));
        assert_eq!(unique_path(&dir, "y.png"), dir.join("y.png"));
        std::fs::remove_dir_all(&dir).ok();
    }
}
