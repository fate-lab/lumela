import { Background, BeautifySettings, Box, computeLayout, coverRect, Layout, RGB, rgbToHex, unit } from "./beautify";

export interface Source {
  /** Full screenshot pixels. */
  canvas: HTMLCanvasElement;
  /** Region of `canvas` to use (after auto-balance). */
  crop: Box;
  /** Colour used to fill the inset. */
  edge: RGB;
  /** Minimum corner radius (window captures). */
  minRadius: number;
}

/** Decoded background picture for `kind: "image"` backgrounds. */
export type BackgroundImage = ImageBitmap | HTMLCanvasElement | HTMLImageElement;

function roundRect(ctx: CanvasRenderingContext2D, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, r);
  ctx.closePath();
}

function paintBackground(
  ctx: CanvasRenderingContext2D, bg: Background, w: number, h: number, scale: number, img?: BackgroundImage | null,
) {
  if (bg.kind === "none") return;
  if (bg.kind === "image") {
    if (!img) {
      ctx.fillStyle = "#8a8f98";
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const blur = bg.blur * unit(w, h);
    // Draw past the edges while blurring so the borders don't fade to transparent.
    const grow = blur * 2;
    const src = coverRect(img.width, img.height, w + 2 * grow, h + 2 * grow);
    ctx.save();
    // Canvas filters work in device pixels, so the blur follows the render scale.
    ctx.filter = `brightness(${bg.brightness / 100}) blur(${blur * scale}px)`;
    ctx.drawImage(img, src.x, src.y, src.w, src.h, -grow, -grow, w + 2 * grow, h + 2 * grow);
    ctx.restore();
    return;
  }
  if (bg.kind === "solid") {
    ctx.fillStyle = bg.color;
  } else {
    const a = (bg.angle * Math.PI) / 180;
    const cx = w / 2, cy = h / 2;
    const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
    const dx = (Math.sin(a) * len) / 2, dy = (-Math.cos(a) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, w, h);
}

export interface Watermark { text: string; position: "bottom-right" | "bottom-center" | "bottom-left" }

/** Expands {date} in watermark text. */
export function watermarkText(template: string, now = new Date()): string {
  return template.replace(/\{date\}/g, now.toLocaleDateString());
}

/**
 * Watermark placement: in the bottom padding when there is room, otherwise inside the
 * card's bottom corner. Font size follows the composite size.
 */
export function watermarkPlacement(L: Layout, position: Watermark["position"]) {
  const size = Math.max(11, Math.round(Math.min(L.width, L.height) * 0.022));
  const margin = size * 0.9;
  const below = L.height - (L.frame.y + L.frame.h);
  const inPadding = below >= size * 1.8;
  const y = inPadding ? L.frame.y + L.frame.h + below / 2 : L.frame.y + L.frame.h - margin;
  const x = position === "bottom-left" ? (inPadding ? L.frame.x : L.frame.x + margin)
    : position === "bottom-center" ? L.width / 2
    : inPadding ? L.frame.x + L.frame.w : L.frame.x + L.frame.w - margin;
  const align: CanvasTextAlign = position === "bottom-left" ? "left" : position === "bottom-center" ? "center" : "right";
  return { x, y, size, align, inPadding };
}

function paintWatermark(ctx: CanvasRenderingContext2D, wm: Watermark, L: Layout) {
  const text = watermarkText(wm.text).trim();
  if (!text) return;
  const p = watermarkPlacement(L, wm.position);
  ctx.save();
  ctx.font = `600 ${p.size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = p.align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = p.size * 0.4;
  ctx.fillText(text, p.x, p.y);
  ctx.restore();
}

/**
 * Draws the composite into `target` at `scale` (1 = full resolution export).
 * Returns the full-resolution layout.
 */
export function render(
  target: HTMLCanvasElement, src: Source, s: BeautifySettings, bg: Background, scale = 1, bgImage?: BackgroundImage | null,
  watermark?: Watermark | null,
): Layout {
  const L = computeLayout(src.crop.w, src.crop.h, s, src.minRadius);
  target.width = Math.max(1, Math.round(L.width * scale));
  target.height = Math.max(1, Math.round(L.height * scale));
  const ctx = target.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, L.width, L.height);
  ctx.imageSmoothingQuality = "high";

  paintBackground(ctx, bg, L.width, L.height, scale, bgImage);

  // Card with shadow, filled with the screenshot's edge colour (visible as inset).
  ctx.save();
  if (L.shadow.alpha > 0 && bg.kind !== "none") {
    ctx.shadowColor = `rgba(0,0,0,${L.shadow.alpha})`;
    ctx.shadowBlur = L.shadow.blur * scale;
    ctx.shadowOffsetY = L.shadow.offsetY * scale;
  }
  ctx.fillStyle = rgbToHex(src.edge);
  roundRect(ctx, L.frame, L.radius);
  ctx.fill();
  ctx.restore();

  // Screenshot, clipped to the card's rounded shape.
  ctx.save();
  roundRect(ctx, L.frame, L.radius);
  ctx.clip();
  const c = src.crop;
  ctx.drawImage(src.canvas, c.x, c.y, c.w, c.h, L.image.x, L.image.y, L.image.w, L.image.h);
  ctx.restore();

  if (watermark) paintWatermark(ctx, watermark, L);
  return L;
}
