//! macOS Vision (VNRecognizeTextRequest). Vision returns line boxes; word boxes are
//! approximated by splitting the line box by character share (objc2-vision does not
//! bind `boundingBoxForRange:`).

use std::io::Cursor;

use image::RgbaImage;
use objc2::AnyThread;
use objc2_foundation::{NSArray, NSData, NSDictionary, NSString};
use objc2_vision::{VNImageRequestHandler, VNRecognizeTextRequest, VNRequest, VNRequestTextRecognitionLevel};

use super::{split_words, Line, OcrEngine, OcrLanguage, OcrResult};

pub struct VisionOcr;

impl OcrEngine for VisionOcr {
    fn recognize(&self, image: &RgbaImage, language: Option<&str>) -> Result<OcrResult, String> {
        let mut png = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;
        let data = NSData::with_bytes(&png);
        let handler = VNImageRequestHandler::initWithData_options(VNImageRequestHandler::alloc(), &data, &NSDictionary::new());

        let request = VNRecognizeTextRequest::new();
        request.setRecognitionLevel(VNRequestTextRecognitionLevel::Accurate);
        request.setUsesLanguageCorrection(true);
        if let Some(tag) = language.filter(|l| !l.is_empty()) {
            request.setRecognitionLanguages(&NSArray::from_retained_slice(&[NSString::from_str(tag)]));
        }
        // VNRecognizeTextRequest → VNImageBasedRequest → VNRequest via Deref.
        let as_request: &VNRequest = &request;
        handler
            .performRequests_error(&NSArray::from_slice(&[as_request]))
            .map_err(|e| format!("Vision error: {}", e.localizedDescription()))?;

        let (iw, ih) = (image.width() as f32, image.height() as f32);
        let mut lines = Vec::new();
        if let Some(results) = request.results() {
            for obs in results.iter() {
                let Some(best) = obs.topCandidates(1).firstObject() else { continue };
                let text = best.string().to_string();
                // Normalised, origin bottom-left → pixels, origin top-left.
                let b = unsafe { obs.boundingBox() };
                let (x, w) = (b.origin.x as f32 * iw, b.size.width as f32 * iw);
                let h = b.size.height as f32 * ih;
                let y = ih - (b.origin.y as f32 * ih) - h;
                lines.push(Line { words: split_words(&text, x, y, w, h), text });
            }
        }
        Ok(OcrResult { lines })
    }

    fn languages(&self) -> Result<Vec<OcrLanguage>, String> {
        let request = VNRecognizeTextRequest::new();
        let langs = unsafe { request.supportedRecognitionLanguagesAndReturnError() }
            .map_err(|e| format!("Vision error: {}", e.localizedDescription()))?;
        Ok(langs.iter().map(|s| OcrLanguage { tag: s.to_string(), name: s.to_string() }).collect())
    }
}
