import { describe, expect, it } from "vitest";
import { autoGradient, computeLayout, coverRect, DEFAULT_SETTINGS, dominantEdgeColor, rgbToHsl, trimBounds } from "./beautify";

function solid(w: number, h: number, rgb: [number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([...rgb, 255], i * 4);
  return d;
}

describe("computeLayout", () => {
  it("centers the frame with padding from the shorter side", () => {
    const l = computeLayout(400, 200, { ...DEFAULT_SETTINGS, padding: 10, inset: 0, ratio: "auto" });
    expect(l.width).toBe(440);
    expect(l.height).toBe(240);
    expect(l.frame).toEqual({ x: 20, y: 20, w: 400, h: 200 });
    expect(l.image).toEqual(l.frame);
  });

  it("expands to the requested ratio", () => {
    const l = computeLayout(400, 400, { ...DEFAULT_SETTINGS, padding: 0, ratio: "16:9" });
    expect(l.height).toBe(400);
    expect(l.width).toBe(711);
    expect(l.frame.x).toBe(Math.round((711 - 400) / 2));
  });

  it("places the image inside the inset", () => {
    const l = computeLayout(2000, 1000, { ...DEFAULT_SETTINGS, padding: 0, inset: 10, ratio: "auto" });
    expect(l.insetPx).toBe(20); // unit = 2 at 2000px
    expect(l.image.x - l.frame.x).toBe(20);
    expect(l.frame.w).toBe(2040);
  });

  it("honours a minimum radius", () => {
    expect(computeLayout(100, 100, { ...DEFAULT_SETTINGS, radius: 0 }, 10).radius).toBe(10);
  });
});

describe("coverRect", () => {
  it("crops the sides of a wide image for a square target", () => {
    expect(coverRect(200, 100, 50, 50)).toEqual({ x: 50, y: 0, w: 100, h: 100 });
  });
  it("crops top and bottom of a tall image for a wide target", () => {
    expect(coverRect(100, 400, 200, 100)).toEqual({ x: 0, y: 175, w: 100, h: 50 });
  });
});

describe("colour analysis", () => {
  it("finds the dominant edge colour", () => {
    const d = solid(10, 10, [250, 250, 250]);
    d.set([0, 0, 0, 255], 0); // one dark corner pixel
    expect(dominantEdgeColor(d, 10, 10)).toEqual([250, 250, 250]);
  });

  it("trims uniform borders", () => {
    const w = 20, h = 10;
    const d = solid(w, h, [255, 255, 255]);
    for (let y = 3; y < 7; y++) for (let x = 5; x < 12; x++) d.set([10, 20, 30, 255], (y * w + x) * 4);
    expect(trimBounds(d, w, h, [255, 255, 255])).toEqual({ x: 5, y: 3, w: 7, h: 4 });
  });

  it("never trims to nothing", () => {
    const b = trimBounds(solid(5, 5, [0, 0, 0]), 5, 5, [0, 0, 0]);
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });

  it("hsl conversion", () => {
    const [h, s, l] = rgbToHsl([255, 0, 0]);
    expect([Math.round(h), s, l]).toEqual([0, 1, 0.5]);
  });

  it("auto gradient follows the hue, and handles neutrals", () => {
    const g = autoGradient([30, 120, 220]);
    expect(g.kind).toBe("gradient");
    expect(autoGradient([255, 255, 255])).toMatchObject({ kind: "gradient", from: "#6a85b6" });
  });
});
