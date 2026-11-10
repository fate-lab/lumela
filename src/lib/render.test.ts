import { describe, expect, it } from "vitest";
import { computeLayout, DEFAULT_SETTINGS } from "./beautify";
import { watermarkPlacement, watermarkText } from "./render";

describe("watermark", () => {
  it("sits in the bottom padding when there is room", () => {
    const L = computeLayout(1000, 600, { ...DEFAULT_SETTINGS, padding: 20, ratio: "auto" });
    const p = watermarkPlacement(L, "bottom-right");
    expect(p.inPadding).toBe(true);
    expect(p.y).toBeGreaterThan(L.frame.y + L.frame.h);
    expect(p.x).toBe(L.frame.x + L.frame.w);
    expect(p.align).toBe("right");
  });

  it("moves inside the card without padding", () => {
    const L = computeLayout(1000, 600, { ...DEFAULT_SETTINGS, padding: 0, ratio: "auto" });
    const p = watermarkPlacement(L, "bottom-center");
    expect(p.inPadding).toBe(false);
    expect(p.y).toBeLessThan(L.frame.y + L.frame.h);
    expect(p.x).toBe(L.width / 2);
  });

  it("expands {date}", () => {
    expect(watermarkText("by me · {date}", new Date(2026, 10, 10))).toBe(`by me · ${new Date(2026, 10, 10).toLocaleDateString()}`);
  });
});
