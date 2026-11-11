//! Finds sensitive text (emails, card numbers, IP addresses, API keys) in OCR output
//! and returns the boxes to cover.

use std::net::{Ipv4Addr, Ipv6Addr};
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::ocr::{OcrResult, Word};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    Email,
    CreditCard,
    IpAddress,
    ApiKey,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Categories {
    pub emails: bool,
    pub credit_cards: bool,
    pub ip_addresses: bool,
    pub api_keys: bool,
}

impl Default for Categories {
    fn default() -> Self {
        Self { emails: true, credit_cards: true, ip_addresses: true, api_keys: true }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Hit {
    pub category: Category,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

static EMAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}").unwrap());
static KEY_PREFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"^(sk|pk|rk)[-_](live|test|proj)?[-_]?[A-Za-z0-9_-]{12,}",
        r"|^gh[pousr]_[A-Za-z0-9]{20,}|^github_pat_[A-Za-z0-9_]{20,}",
        r"|^xox[abposr]-[A-Za-z0-9-]{10,}",
        r"|^AKIA[0-9A-Z]{16}$|^AIza[0-9A-Za-z_-]{30,}",
        r"|^glpat-[A-Za-z0-9_-]{16,}|^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
    ))
    .unwrap()
});

/// Text after a word-like "label:" or "label=" prefix, without surrounding punctuation.
/// Only alphabetic labels are removed, so IPv6 addresses and "host:port" stay intact.
fn token(text: &str) -> &str {
    let t = match text.find([':', '=']) {
        Some(i) if i > 0 && text[..i].chars().all(|c| c.is_alphabetic() || c == '_' || c == '-') => &text[i + 1..],
        _ => text,
    };
    t.trim_matches(|c: char| matches!(c, '"' | '\'' | ',' | ';' | '(' | ')' | '[' | ']' | '<' | '>' | '`'))
}

fn is_ip(text: &str) -> bool {
    let t = text.trim_matches(|c: char| !c.is_ascii_hexdigit() && c != ':' && c != '.');
    // Strip a port from IPv4 ("10.0.0.1:8080").
    let v4 = t.split(':').next().unwrap_or(t);
    if v4.matches('.').count() == 3 && v4.parse::<Ipv4Addr>().is_ok() {
        return true;
    }
    t.matches(':').count() >= 2 && t.parse::<Ipv6Addr>().is_ok()
}

/// Shannon entropy in bits per character.
fn entropy(s: &str) -> f64 {
    let mut counts = [0u32; 256];
    for b in s.bytes() {
        counts[b as usize] += 1;
    }
    let n = s.len() as f64;
    counts.iter().filter(|&&c| c > 0).map(|&c| {
        let p = c as f64 / n;
        -p * p.log2()
    }).sum()
}

fn is_api_key(text: &str) -> bool {
    let t = token(text);
    if KEY_PREFIX.is_match(t) {
        return true;
    }
    // Long random-looking tokens: letters and digits mixed, high entropy, no spaces.
    t.len() >= 28
        && t.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '+' | '/'))
        && t.chars().any(|c| c.is_ascii_digit())
        && t.chars().any(|c| c.is_ascii_uppercase())
        && t.chars().any(|c| c.is_ascii_lowercase())
        && entropy(t) >= 3.8
}

pub fn luhn(digits: &str) -> bool {
    let mut sum = 0;
    for (i, c) in digits.chars().rev().enumerate() {
        let Some(mut d) = c.to_digit(10) else { return false };
        if i % 2 == 1 {
            d *= 2;
            if d > 9 {
                d -= 9;
            }
        }
        sum += d;
    }
    !digits.is_empty() && sum % 10 == 0
}

fn union(words: &[&Word]) -> (f32, f32, f32, f32) {
    let x0 = words.iter().map(|w| w.x).fold(f32::MAX, f32::min);
    let y0 = words.iter().map(|w| w.y).fold(f32::MAX, f32::min);
    let x1 = words.iter().map(|w| w.x + w.w).fold(f32::MIN, f32::max);
    let y1 = words.iter().map(|w| w.y + w.h).fold(f32::MIN, f32::max);
    (x0, y0, x1 - x0, y1 - y0)
}

fn hit(category: Category, words: &[&Word]) -> Hit {
    let (x, y, w, h) = union(words);
    Hit { category, x, y, w, h }
}

/// Card numbers are often split into groups ("4111 1111 1111 1111"): look for runs of
/// digit-only words whose digits pass the Luhn check.
fn card_hits(words: &[Word]) -> Vec<Hit> {
    let digits = |w: &Word| -> Option<String> {
        let t = token(&w.text);
        (!t.is_empty() && t.chars().all(|c| c.is_ascii_digit() || c == '-')).then(|| t.replace('-', ""))
    };
    let mut out = Vec::new();
    let mut i = 0;
    while i < words.len() {
        let mut best: Option<usize> = None;
        let mut acc = String::new();
        for (j, w) in words.iter().enumerate().skip(i) {
            let Some(d) = digits(w) else { break };
            acc.push_str(&d);
            if acc.len() > 19 {
                break;
            }
            if (13..=19).contains(&acc.len()) && luhn(&acc) {
                best = Some(j);
            }
        }
        match best {
            Some(j) => {
                out.push(hit(Category::CreditCard, &words[i..=j].iter().collect::<Vec<_>>()));
                i = j + 1;
            }
            None => i += 1,
        }
    }
    out
}

fn tokenish(text: &str) -> bool {
    !text.is_empty() && text.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '+' | '/' | '='))
}

/// A piece of a key rather than a word: it has a digit, or capitals after the first letter.
fn looks_random(text: &str) -> bool {
    text.chars().any(|c| c.is_ascii_digit())
        || (text.chars().skip(1).any(|c| c.is_ascii_uppercase()) && text.chars().any(|c| c.is_ascii_lowercase()))
}

/// Indices of `words[k]` and the token-like pieces right after it on the same line.
/// OCR often splits a long key into pieces ("…vXz1 aBc").
fn with_adjacent_pieces(words: &[Word], k: usize) -> Vec<usize> {
    let mut out = vec![k];
    let mut last = &words[k];
    for (j, next) in words.iter().enumerate().skip(k + 1) {
        let gap = next.x - (last.x + last.w);
        if gap > last.h * 0.8 || !tokenish(&next.text) {
            break;
        }
        out.push(j);
        last = next;
    }
    out
}

/// True when `b`, the first word of a line, sits right under the line that ends with `a`
/// and starts further left: what a key looks like when it wraps.
fn wraps_onto(a: &Word, b: &Word) -> bool {
    let gap = b.y - (a.y + a.h);
    b.y > a.y && gap >= -a.h * 0.2 && gap <= a.h && b.x < a.x
}

pub fn detect(ocr: &OcrResult, cats: Categories) -> Vec<Hit> {
    let mut hits = Vec::new();
    // Per line, which words are covered by an API key hit (used to follow wrapped keys).
    let mut key_words: Vec<Vec<bool>> = Vec::with_capacity(ocr.lines.len());
    for line in &ocr.lines {
        let mut keys = vec![false; line.words.len()];
        let mut used = vec![false; line.words.len()];
        if cats.credit_cards {
            for h in card_hits(&line.words) {
                for (k, w) in line.words.iter().enumerate() {
                    if w.x >= h.x - 0.5 && w.x + w.w <= h.x + h.w + 0.5 {
                        used[k] = true;
                    }
                }
                hits.push(h);
            }
        }
        for k in 0..line.words.len() {
            let w = &line.words[k];
            if used[k] {
                continue;
            }
            let category = if cats.emails && EMAIL.is_match(&w.text) {
                Some(Category::Email)
            } else if cats.ip_addresses && is_ip(token(&w.text)) {
                Some(Category::IpAddress)
            } else if cats.api_keys && is_api_key(&w.text) {
                Some(Category::ApiKey)
            } else {
                None
            };
            if let Some(c) = category {
                let idx = if c == Category::ApiKey { with_adjacent_pieces(&line.words, k) } else { vec![k] };
                for &j in &idx {
                    used[j] = true;
                    keys[j] = c == Category::ApiKey;
                }
                hits.push(hit(c, &idx.iter().map(|&j| &line.words[j]).collect::<Vec<_>>()));
            }
        }
        key_words.push(keys);
    }

    // A key that does not fit on one line continues at the start of the next one.
    if cats.api_keys {
        for i in 0..ocr.lines.len().saturating_sub(1) {
            let (la, lb) = (&ocr.lines[i].words, &ocr.lines[i + 1].words);
            let (Some(a), Some(b)) = (la.last(), lb.first()) else { continue };
            let ai = la.len() - 1;
            let tail = token(&a.text);
            if key_words[i + 1][0] || !wraps_onto(a, b) || !tokenish(tail) || !tokenish(&b.text) || !looks_random(&b.text) {
                continue;
            }
            let a_is_key = key_words[i][ai];
            if !a_is_key && !is_api_key(&format!("{tail}{}", b.text)) {
                continue;
            }
            if !a_is_key {
                key_words[i][ai] = true;
                hits.push(hit(Category::ApiKey, &[a]));
            }
            let idx = with_adjacent_pieces(lb, 0);
            for &j in &idx {
                key_words[i + 1][j] = true;
            }
            hits.push(hit(Category::ApiKey, &idx.iter().map(|&j| &lb[j]).collect::<Vec<_>>()));
        }
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ocr::Line;

    fn line(words: &[&str]) -> Line {
        let mut x = 0.0;
        let words: Vec<Word> = words
            .iter()
            .map(|t| {
                let w = Word { text: t.to_string(), x, y: 10.0, w: t.len() as f32 * 10.0, h: 20.0 };
                x += w.w + 10.0;
                w
            })
            .collect();
        Line { text: String::new(), words }
    }

    fn cats_found(words: &[&str]) -> Vec<Category> {
        detect(&OcrResult { lines: vec![line(words)] }, Categories::default()).into_iter().map(|h| h.category).collect()
    }

    #[test]
    fn luhn_check() {
        assert!(luhn("4111111111111111"));
        assert!(!luhn("4111111111111112"));
    }

    #[test]
    fn finds_each_category() {
        assert_eq!(cats_found(&["Email:", "jane.doe@example.com"]), vec![Category::Email]);
        assert_eq!(cats_found(&["Server", "IP:", "192.168.10.24"]), vec![Category::IpAddress]);
        assert_eq!(cats_found(&["host", "fe80::1ff:fe23:4567:890a"]), vec![Category::IpAddress]);
        assert_eq!(cats_found(&["API", "key:", "sk-live-9fJ2kLm8QpRt5vXz1aBc"]), vec![Category::ApiKey]);
        assert_eq!(cats_found(&["AKIAIOSFODNN7EXAMPLE"]), vec![Category::ApiKey]);
        assert_eq!(cats_found(&["token=ghp_1234567890abcdefghijABCDEFGHIJ"]), vec![Category::ApiKey]);
    }

    #[test]
    fn grouped_card_number_is_one_box() {
        let l = line(&["Card:", "4111", "1111", "1111", "1111", "exp"]);
        let hits = detect(&OcrResult { lines: vec![l.clone()] }, Categories::default());
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].category, Category::CreditCard);
        assert_eq!(hits[0].x, l.words[1].x);
        assert_eq!(hits[0].x + hits[0].w, l.words[4].x + l.words[4].w);
    }

    #[test]
    fn split_api_key_is_covered_whole() {
        let mut l = line(&["key:", "sk-live-9fJ2kLm8QpRt5vXz1", "aBc", "Save"]);
        // OCR puts the stray piece right next to the key; "Save" is far away.
        l.words[2].x = l.words[1].x + l.words[1].w + 4.0;
        l.words[3].x = l.words[2].x + l.words[2].w + 200.0;
        let hits = detect(&OcrResult { lines: vec![l.clone()] }, Categories::default());
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].x + hits[0].w, l.words[2].x + l.words[2].w);
    }

    /// A second line starting at the left margin, just below `first`.
    fn next_line(first: &Line, words: &[&str]) -> Line {
        let mut l = line(words);
        for w in &mut l.words {
            w.y = first.words[0].y + first.words[0].h + 6.0;
        }
        l
    }

    fn covers(h: &Hit, w: &Word) -> bool {
        w.x >= h.x - 0.5 && w.x + w.w <= h.x + h.w + 0.5 && w.y >= h.y - 0.5 && w.y + w.h <= h.y + h.h + 0.5
    }

    #[test]
    fn wrapped_key_tail_on_next_line_is_covered() {
        // The first part is a key on its own; the short tail wraps to the next line.
        let a = line(&["API", "key:", "sk-live-9fJ2kLm8QpRt"]);
        let b = next_line(&a, &["5vXz1aBcQ7", "is", "active"]);
        let hits = detect(&OcrResult { lines: vec![a.clone(), b.clone()] }, Categories::default());
        assert!(hits.iter().any(|h| h.category == Category::ApiKey && covers(h, &a.words[2])), "{hits:?}");
        assert!(hits.iter().any(|h| h.category == Category::ApiKey && covers(h, &b.words[0])), "{hits:?}");
    }

    #[test]
    fn key_split_into_two_short_halves_across_lines_is_covered() {
        // Neither half is long enough to look like a key alone; together they are.
        let a = line(&["token:", "a8F3kQ9zLm2Xv7Tq"]);
        let b = next_line(&a, &["B7nP0wRt5YcE4uHs"]);
        let hits = detect(&OcrResult { lines: vec![a.clone(), b.clone()] }, Categories::default());
        assert!(hits.iter().any(|h| covers(h, &a.words[1])), "{hits:?}");
        assert!(hits.iter().any(|h| covers(h, &b.words[0])), "{hits:?}");
    }

    #[test]
    fn ordinary_next_line_is_not_swallowed() {
        let a = line(&["API", "key:", "sk-live-9fJ2kLm8QpRt5vXz1aBc"]);
        let b = next_line(&a, &["Created", "yesterday"]);
        let hits = detect(&OcrResult { lines: vec![a.clone(), b.clone()] }, Categories::default());
        assert_eq!(hits.len(), 1, "{hits:?}");
        assert!(!hits.iter().any(|h| covers(h, &b.words[0])));
    }

    #[test]
    fn ignores_ordinary_text() {
        assert!(cats_found(&["Version", "1.2.3", "released", "on", "2026-11-10", "build", "12345"]).is_empty());
        assert!(cats_found(&["Account", "settings"]).is_empty());
        assert!(cats_found(&["4111", "1111", "1111", "1112"]).is_empty());
    }

    /// End to end on the real platform OCR engine (Windows.Media.Ocr, macOS Vision,
    /// tesseract on Linux). CI runs it on all three.
    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    #[test]
    fn platform_ocr_finds_all_categories_in_fixture() {
        use crate::ocr::engine;
        let lang = if cfg!(target_os = "linux") { "eng" } else { "en-US" };
        let img = image::open(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/sensitive.png")).unwrap().to_rgba8();
        let ocr = engine().recognize(&img, Some(lang)).or_else(|_| engine().recognize(&img, None)).unwrap();
        let mut found: Vec<Category> = detect(&ocr, Categories::default()).into_iter().map(|h| h.category).collect();
        found.sort_by_key(|c| *c as u8);
        found.dedup();
        assert_eq!(
            found,
            vec![Category::Email, Category::CreditCard, Category::IpAddress, Category::ApiKey],
            "OCR lines: {:?}",
            ocr.lines.iter().map(|l| &l.text).collect::<Vec<_>>()
        );
    }

    /// Keys that wrap onto the next line, read by the real platform OCR engine.
    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    #[test]
    fn platform_ocr_covers_wrapped_keys_in_fixture() {
        use crate::ocr::engine;
        let lang = if cfg!(target_os = "linux") { "eng" } else { "en-US" };
        let img = image::open(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/wrapped-key.png")).unwrap().to_rgba8();
        let ocr = engine().recognize(&img, Some(lang)).or_else(|_| engine().recognize(&img, None)).unwrap();
        let hits = detect(&ocr, Categories::default());
        let lines: Vec<&String> = ocr.lines.iter().map(|l| &l.text).collect();
        // Each piece of both keys, on both lines, must be under an API key box.
        for piece in ["9fJ2", "5vXz", "a8F3", "B7nP"] {
            let words: Vec<&Word> = ocr.lines.iter().flat_map(|l| &l.words).filter(|w| w.text.contains(piece)).collect();
            assert!(!words.is_empty(), "OCR did not read {piece}: {lines:?}");
            for w in words {
                assert!(
                    hits.iter().any(|h| h.category == Category::ApiKey && covers(h, w)),
                    "{piece} ({:?}) is not covered. OCR lines: {lines:?}, hits: {hits:?}",
                    w.text
                );
            }
        }
    }

    #[test]
    fn respects_disabled_categories() {
        let cats = Categories { emails: false, ..Default::default() };
        let r = detect(&OcrResult { lines: vec![line(&["a@b.com"])] }, cats);
        assert!(r.is_empty());
    }
}
