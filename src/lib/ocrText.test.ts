import { describe, expect, it } from "vitest";
import { hitsToRects, key, selectedText, wordsInCrop } from "./ocrText";

const ocr = {
  lines: [
    { text: "Hello world", words: [{ text: "Hello", x: 10, y: 10, w: 50, h: 20 }, { text: "world", x: 70, y: 10, w: 50, h: 20 }] },
    { text: "Second line", words: [{ text: "Second", x: 10, y: 40, w: 60, h: 20 }, { text: "line", x: 80, y: 40, w: 40, h: 20 }] },
  ],
};

describe("ocr text helpers", () => {
  it("moves words into crop coordinates", () => {
    const w = wordsInCrop(ocr, { x: 5, y: 5, w: 100, h: 100 });
    expect(w[0].box).toEqual({ x: 5, y: 5, w: 50, h: 20 });
    expect(w).toHaveLength(4);
  });

  it("joins selected words in reading order", () => {
    const w = wordsInCrop(ocr, { x: 0, y: 0, w: 0, h: 0 });
    const sel = new Set([key(w[3]), key(w[0]), key(w[2])]);
    expect(selectedText(w, sel)).toBe("Hello\nSecond line");
  });

  it("pads redaction rects", () => {
    expect(hitsToRects([{ category: "email", x: 10, y: 10, w: 20, h: 10 }], { x: 5, y: 0, w: 0, h: 0 }, 2))
      .toEqual([{ x: 3, y: 8, w: 24, h: 14 }]);
  });
});
