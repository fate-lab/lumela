//! On-device text recognition behind one interface, with a native engine per OS:
//! Windows.Media.Ocr, macOS Vision, tesseract on Linux.

use image::RgbaImage;
use serde::Serialize;

#[cfg(windows)]
mod windows;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "linux")]
mod linux;
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
mod tsv;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Word {
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Line {
    pub text: String,
    pub words: Vec<Word>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct OcrResult {
    pub lines: Vec<Line>,
}

impl OcrResult {
    /// Multiplies every box by `factor` (used when the engine saw a resized image).
    #[cfg_attr(not(windows), allow(dead_code))]
    pub fn scaled(mut self, factor: f32) -> Self {
        for w in self.lines.iter_mut().flat_map(|l| l.words.iter_mut()) {
            w.x *= factor;
            w.y *= factor;
            w.w *= factor;
            w.h *= factor;
        }
        self
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct OcrLanguage {
    pub tag: String,
    pub name: String,
}

pub trait OcrEngine {
    /// Recognises text; boxes are in `image` pixel coordinates.
    fn recognize(&self, image: &RgbaImage, language: Option<&str>) -> Result<OcrResult, String>;
    fn languages(&self) -> Result<Vec<OcrLanguage>, String>;
}

struct Unsupported;
impl OcrEngine for Unsupported {
    fn recognize(&self, _: &RgbaImage, _: Option<&str>) -> Result<OcrResult, String> {
        Err("Text recognition is not supported on this platform".into())
    }
    fn languages(&self) -> Result<Vec<OcrLanguage>, String> {
        Ok(vec![])
    }
}

/// The engine for the current platform.
pub fn engine() -> Box<dyn OcrEngine + Send> {
    #[cfg(windows)]
    return Box::new(windows::WindowsOcr);
    #[cfg(target_os = "macos")]
    return Box::new(macos::VisionOcr);
    #[cfg(target_os = "linux")]
    return Box::new(linux::Tesseract);
    #[allow(unreachable_code)]
    Box::new(Unsupported)
}

/// Downscales so the longest side is at most `max`; returns the image and the factor
/// to multiply boxes by to get back to the original size. Used by engines with an
/// input size limit (Windows.Media.Ocr).
#[cfg_attr(not(windows), allow(dead_code))]
pub fn fit_for_engine(image: &RgbaImage, max: u32) -> (std::borrow::Cow<'_, RgbaImage>, f32) {
    let longest = image.width().max(image.height());
    if longest <= max {
        return (std::borrow::Cow::Borrowed(image), 1.0);
    }
    let s = max as f32 / longest as f32;
    let (w, h) = (((image.width() as f32) * s).round() as u32, ((image.height() as f32) * s).round() as u32);
    let small = image::imageops::resize(image, w.max(1), h.max(1), image::imageops::FilterType::Triangle);
    (std::borrow::Cow::Owned(small), 1.0 / s)
}

/// Splits a line box into word boxes proportionally to the characters (spaces included).
/// Used by engines that only report line boxes.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(crate) fn split_words(text: &str, x: f32, y: f32, w: f32, h: f32) -> Vec<Word> {
    let total = text.chars().count().max(1) as f32;
    let mut out = Vec::new();
    let mut offset = 0usize;
    for part in text.split(' ') {
        let len = part.chars().count();
        if len > 0 {
            out.push(Word { text: part.to_string(), x: x + w * (offset as f32 / total), y, w: w * (len as f32 / total), h });
        }
        offset += len + 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_words_by_character_share() {
        let w = split_words("ab cd", 0.0, 0.0, 50.0, 10.0);
        assert_eq!(w.len(), 2);
        let r = |v: f32| v.round();
        assert_eq!((r(w[0].x), r(w[0].w)), (0.0, 20.0));
        assert_eq!((r(w[1].x), r(w[1].w)), (30.0, 20.0));
    }

    #[test]
    fn fit_keeps_small_images() {
        let img = RgbaImage::new(100, 50);
        let (out, f) = fit_for_engine(&img, 200);
        assert_eq!((out.width(), f), (100, 1.0));
    }

    #[test]
    fn fit_downscales_and_reports_factor() {
        let img = RgbaImage::new(4000, 1000);
        let (out, f) = fit_for_engine(&img, 2000);
        assert_eq!((out.width(), out.height()), (2000, 500));
        assert_eq!(f, 2.0);
    }

    #[test]
    fn scaled_multiplies_boxes() {
        let r = OcrResult {
            lines: vec![Line { text: "a".into(), words: vec![Word { text: "a".into(), x: 1.0, y: 2.0, w: 3.0, h: 4.0 }] }],
        }
        .scaled(2.0);
        assert_eq!(r.lines[0].words[0], Word { text: "a".into(), x: 2.0, y: 4.0, w: 6.0, h: 8.0 });
    }
}
