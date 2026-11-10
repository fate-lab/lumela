//! tesseract CLI backend. Requires the `tesseract` binary and language data
//! (e.g. `apt install tesseract-ocr tesseract-ocr-eng`).

use std::process::Command;

use image::RgbaImage;

use super::{tsv, OcrEngine, OcrLanguage, OcrResult};

pub struct Tesseract;

fn not_found(e: std::io::Error) -> String {
    format!("Could not run tesseract ({e}). Install it with: sudo apt install tesseract-ocr")
}

impl OcrEngine for Tesseract {
    fn recognize(&self, image: &RgbaImage, language: Option<&str>) -> Result<OcrResult, String> {
        let path = std::env::temp_dir().join(format!("scs-ocr-{}.png", std::process::id()));
        image.save(&path).map_err(|e| e.to_string())?;
        let mut cmd = Command::new("tesseract");
        cmd.arg(&path).arg("stdout");
        if let Some(l) = language.filter(|l| !l.is_empty()) {
            cmd.args(["-l", l]);
        }
        cmd.arg("tsv");
        let out = cmd.output().map_err(not_found);
        let _ = std::fs::remove_file(&path);
        let out = out?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Ok(tsv::parse(&String::from_utf8_lossy(&out.stdout), 30.0))
    }

    fn languages(&self) -> Result<Vec<OcrLanguage>, String> {
        let out = Command::new("tesseract").arg("--list-langs").output().map_err(not_found)?;
        Ok(String::from_utf8_lossy(&out.stdout)
            .lines()
            .skip(1)
            .filter(|l| !l.trim().is_empty() && *l != "osd")
            .map(|l| OcrLanguage { tag: l.trim().into(), name: l.trim().into() })
            .collect())
    }
}
