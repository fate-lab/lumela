//! Windows.Media.Ocr (WinRT). Ships with Windows 10/11; languages follow the
//! installed language packs.

use image::RgbaImage;
use windows::core::HSTRING;
use windows::Globalization::Language;
use windows::Graphics::Imaging::{BitmapAlphaMode, BitmapPixelFormat, SoftwareBitmap};
use windows::Media::Ocr::OcrEngine as WinOcrEngine;
use windows::Storage::Streams::DataWriter;
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

use super::{fit_for_engine, Line, OcrEngine, OcrLanguage, OcrResult, Word};

pub struct WindowsOcr;

fn err(e: windows::core::Error) -> String {
    format!("OCR error: {}", e.message())
}

fn init_thread() {
    // Safe to call repeatedly; "already initialised" results are fine.
    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }
}

fn create_engine(language: Option<&str>) -> Result<WinOcrEngine, String> {
    let engine = match language {
        Some(tag) if !tag.is_empty() => {
            let lang = Language::CreateLanguage(&HSTRING::from(tag)).map_err(err)?;
            WinOcrEngine::TryCreateFromLanguage(&lang).map_err(err)?
        }
        _ => WinOcrEngine::TryCreateFromUserProfileLanguages().map_err(err)?,
    };
    Ok(engine)
}

impl OcrEngine for WindowsOcr {
    fn recognize(&self, image: &RgbaImage, language: Option<&str>) -> Result<OcrResult, String> {
        init_thread();
        let engine = create_engine(language)?;
        let max = WinOcrEngine::MaxImageDimension().unwrap_or(4096);
        let (img, factor) = fit_for_engine(image, max);

        // Windows OCR takes BGRA8 / Gray8; swap the channels.
        let mut bgra = img.as_raw().clone();
        for px in bgra.as_chunks_mut::<4>().0 {
            px.swap(0, 2);
        }
        let writer = DataWriter::new().map_err(err)?;
        writer.WriteBytes(&bgra).map_err(err)?;
        let buffer = writer.DetachBuffer().map_err(err)?;
        let bitmap = SoftwareBitmap::CreateCopyWithAlphaFromBuffer(
            &buffer,
            BitmapPixelFormat::Bgra8,
            img.width() as i32,
            img.height() as i32,
            BitmapAlphaMode::Premultiplied,
        )
        .map_err(err)?;

        let result = engine.RecognizeAsync(&bitmap).map_err(err)?.join().map_err(err)?;
        let mut lines = Vec::new();
        for line in result.Lines().map_err(err)? {
            let mut words = Vec::new();
            for w in line.Words().map_err(err)? {
                let r = w.BoundingRect().map_err(err)?;
                words.push(Word { text: w.Text().map_err(err)?.to_string(), x: r.X, y: r.Y, w: r.Width, h: r.Height });
            }
            lines.push(Line { text: line.Text().map_err(err)?.to_string(), words });
        }
        Ok(OcrResult { lines }.scaled(factor))
    }

    fn languages(&self) -> Result<Vec<OcrLanguage>, String> {
        init_thread();
        let mut out = Vec::new();
        for l in WinOcrEngine::AvailableRecognizerLanguages().map_err(err)? {
            out.push(OcrLanguage {
                tag: l.LanguageTag().map_err(err)?.to_string(),
                name: l.DisplayName().map_err(err)?.to_string(),
            });
        }
        Ok(out)
    }
}
