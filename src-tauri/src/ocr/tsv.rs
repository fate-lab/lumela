//! Parser for tesseract's TSV output (`tesseract img stdout tsv`). Kept platform
//! independent so it is unit tested everywhere.

use std::collections::BTreeMap;

use super::{Line, OcrResult, Word};

/// Columns: level page_num block_num par_num line_num word_num left top width height conf text
pub fn parse(tsv: &str, min_conf: f32) -> OcrResult {
    let mut lines: BTreeMap<(u32, u32, u32, u32), Vec<Word>> = BTreeMap::new();
    for row in tsv.lines().skip(1) {
        let c: Vec<&str> = row.split('\t').collect();
        if c.len() < 12 || c[0] != "5" {
            continue;
        }
        let text = c[11].trim();
        let conf: f32 = c[10].parse().unwrap_or(-1.0);
        if text.is_empty() || conf < min_conf {
            continue;
        }
        let n = |i: usize| c[i].parse::<u32>().unwrap_or(0);
        let f = |i: usize| c[i].parse::<f32>().unwrap_or(0.0);
        lines.entry((n(1), n(2), n(3), n(4))).or_default().push(Word {
            text: text.to_string(),
            x: f(6),
            y: f(7),
            w: f(8),
            h: f(9),
        });
    }
    OcrResult {
        lines: lines
            .into_values()
            .map(|words| Line { text: words.iter().map(|w| w.text.as_str()).collect::<Vec<_>>().join(" "), words })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
1\t1\t0\t0\t0\t0\t0\t0\t640\t480\t-1\t
4\t1\t1\t1\t1\t0\t10\t10\t200\t20\t-1\t
5\t1\t1\t1\t1\t1\t10\t10\t60\t20\t96.1\tEmail:
5\t1\t1\t1\t1\t2\t80\t10\t130\t20\t91.0\tjane@example.com
5\t1\t1\t1\t2\t1\t10\t40\t40\t20\t12.0\t~~
5\t1\t1\t1\t2\t2\t60\t40\t50\t20\t88.0\tCard
";

    #[test]
    fn groups_words_into_lines_and_drops_low_confidence() {
        let r = parse(SAMPLE, 30.0);
        assert_eq!(r.lines.len(), 2);
        assert_eq!(r.lines[0].text, "Email: jane@example.com");
        assert_eq!(r.lines[0].words[1], Word { text: "jane@example.com".into(), x: 80.0, y: 10.0, w: 130.0, h: 20.0 });
        assert_eq!(r.lines[1].text, "Card");
    }
}
