import type { Box } from "./beautify";
import type { OcrResult, SensitiveHit } from "./ipc";

export interface IndexedWord { line: number; index: number; text: string; box: Box }

/** Flattens OCR words into crop coordinates (OCR runs on the full image). */
export function wordsInCrop(ocr: OcrResult, crop: Box): IndexedWord[] {
  const out: IndexedWord[] = [];
  ocr.lines.forEach((l, line) =>
    l.words.forEach((w, index) =>
      out.push({ line, index, text: w.text, box: { x: w.x - crop.x, y: w.y - crop.y, w: w.w, h: w.h } }),
    ),
  );
  return out;
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Text of the selected words in reading order, one OCR line per output line. */
export function selectedText(words: IndexedWord[], selected: Set<string>): string {
  const byLine = new Map<number, IndexedWord[]>();
  for (const w of words) {
    if (!selected.has(key(w))) continue;
    byLine.set(w.line, [...(byLine.get(w.line) ?? []), w]);
  }
  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, ws]) => ws.sort((a, b) => a.index - b.index).map((w) => w.text).join(" "))
    .join("\n");
}

export const key = (w: IndexedWord) => `${w.line}:${w.index}`;

/** Redaction rectangles in crop coordinates, padded a little so glyph edges don't peek out. */
export function hitsToRects(hits: SensitiveHit[], crop: Box, pad: number): Box[] {
  return hits.map((h) => ({ x: h.x - crop.x - pad, y: h.y - crop.y - pad, w: h.w + 2 * pad, h: h.h + 2 * pad }));
}
