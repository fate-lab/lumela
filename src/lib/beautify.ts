// Pure beautify math: layout, colour analysis and auto-balance. No DOM access here,
// so everything can be unit tested; rendering lives in render.ts.

export type RGB = [number, number, number];

export type Background =
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "solid"; color: string }
  /** Local image file (custom picture or desktop wallpaper). brightness 0–200 (100 = unchanged), blur 0–40. */
  | { kind: "image"; path: string; wallpaper: boolean; brightness: number; blur: number }
  | { kind: "none" };

/** Source rectangle that covers `dw × dh` with an image of `sw × sh` (like CSS object-fit: cover). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): Box {
  const scale = Math.max(dw / sw, dh / sh);
  const w = dw / scale, h = dh / scale;
  return { x: (sw - w) / 2, y: (sh - h) / 2, w, h };
}

export interface BeautifySettings {
  background: Background;
  /** Pick the background from the screenshot's edge colour. */
  autoBackground: boolean;
  /** Trim uniform borders and re-pad evenly. */
  autoBalance: boolean;
  /** 0–100, share of the image's shorter side. */
  padding: number;
  /** 0–100, frame-coloured margin inside the card (px at 1000px reference). */
  inset: number;
  /** 0–60, corner radius (px at 1000px reference). */
  radius: number;
  /** 0–100 */
  shadow: number;
  ratio: RatioId;
}

export const DEFAULT_SETTINGS: BeautifySettings = {
  background: { kind: "gradient", from: "#4facfe", to: "#8e54e9", angle: 135 },
  autoBackground: false,
  autoBalance: true,
  padding: 18,
  inset: 0,
  radius: 12,
  shadow: 45,
  ratio: "auto",
};

export interface GradientPreset {
  id: string;
  name: string;
  from: string;
  to: string;
  angle: number;
}

export const GRADIENTS: GradientPreset[] = [
  { id: "azure", name: "Azure", from: "#4facfe", to: "#8e54e9", angle: 135 },
  { id: "sunrise", name: "Sunrise", from: "#ff9a8b", to: "#ff6a88", angle: 135 },
  { id: "lagoon", name: "Lagoon", from: "#43cea2", to: "#185a9d", angle: 135 },
  { id: "peach", name: "Peach", from: "#ffecd2", to: "#fcb69f", angle: 135 },
  { id: "mint", name: "Mint", from: "#d4fc79", to: "#96e6a1", angle: 135 },
  { id: "ember", name: "Ember", from: "#f12711", to: "#f5af19", angle: 135 },
  { id: "grape", name: "Grape", from: "#8e2de2", to: "#4a00e0", angle: 135 },
  { id: "cotton", name: "Cotton", from: "#fbc2eb", to: "#a6c1ee", angle: 135 },
  { id: "forest", name: "Forest", from: "#134e5e", to: "#71b280", angle: 135 },
  { id: "dusk", name: "Dusk", from: "#2c3e50", to: "#fd746c", angle: 135 },
  { id: "slate", name: "Slate", from: "#232526", to: "#414345", angle: 135 },
  { id: "paper", name: "Paper", from: "#f5f7fa", to: "#c3cfe2", angle: 135 },
];

export type RatioId =
  | "auto" | "1:1" | "4:3" | "3:2" | "16:9" | "9:16"
  | "x" | "instagram" | "instagram-story" | "linkedin" | "facebook" | "youtube";

export const RATIOS: { id: RatioId; label: string; hint: string; value: number | null }[] = [
  { id: "auto", label: "Free", hint: "Image ratio", value: null },
  { id: "1:1", label: "1:1", hint: "Square", value: 1 },
  { id: "4:3", label: "4:3", hint: "", value: 4 / 3 },
  { id: "3:2", label: "3:2", hint: "", value: 3 / 2 },
  { id: "16:9", label: "16:9", hint: "", value: 16 / 9 },
  { id: "9:16", label: "9:16", hint: "Portrait", value: 9 / 16 },
  { id: "x", label: "X / Twitter", hint: "16:9", value: 16 / 9 },
  { id: "instagram", label: "Instagram", hint: "4:5", value: 4 / 5 },
  { id: "instagram-story", label: "IG Story", hint: "9:16", value: 9 / 16 },
  { id: "linkedin", label: "LinkedIn", hint: "1.91:1", value: 1.91 },
  { id: "facebook", label: "Facebook", hint: "1.91:1", value: 1.91 },
  { id: "youtube", label: "YouTube Post", hint: "1:1", value: 1 },
];

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  width: number;
  height: number;
  /** The card: screenshot + inset, receives radius and shadow. */
  frame: Box;
  /** Where the screenshot pixels go. */
  image: Box;
  radius: number;
  insetPx: number;
  shadow: { blur: number; offsetY: number; alpha: number };
}

/** Scale unit so that radius/inset/shadow look the same on small and huge screenshots. */
export function unit(w: number, h: number): number {
  return Math.max(1, Math.max(w, h) / 1000);
}

export function computeLayout(imgW: number, imgH: number, s: BeautifySettings, minRadius = 0): Layout {
  const u = unit(imgW, imgH);
  const insetPx = Math.round(s.inset * u);
  const pad = s.background.kind === "none" && s.padding === 0 ? 0 : Math.round((s.padding / 100) * Math.min(imgW, imgH));
  const frameW = imgW + 2 * insetPx;
  const frameH = imgH + 2 * insetPx;
  let width = frameW + 2 * pad;
  let height = frameH + 2 * pad;

  const ratio = RATIOS.find((r) => r.id === s.ratio)?.value ?? null;
  if (ratio) {
    if (width / height < ratio) width = Math.round(height * ratio);
    else height = Math.round(width / ratio);
  }

  const fx = Math.round((width - frameW) / 2);
  const fy = Math.round((height - frameH) / 2);
  const radius = Math.min(Math.max(s.radius, minRadius) * u, frameW / 2, frameH / 2);
  return {
    width,
    height,
    frame: { x: fx, y: fy, w: frameW, h: frameH },
    image: { x: fx + insetPx, y: fy + insetPx, w: imgW, h: imgH },
    radius,
    insetPx,
    shadow: {
      blur: s.shadow * 0.6 * u,
      offsetY: s.shadow * 0.2 * u,
      alpha: s.shadow === 0 ? 0 : 0.15 + (s.shadow / 100) * 0.35,
    },
  };
}

// ------------------------------------------------------------------ colour

/** Most common colour (4-bit quantised) on the outer 1px border of an RGBA buffer. */
export function dominantEdgeColor(data: Uint8ClampedArray | Uint8Array, w: number, h: number): RGB {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += r; c.g += g; c.b += b;
    counts.set(key, c);
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const c of counts.values()) if (c.n > best.n) best = c;
  if (best.n === 0) return [255, 255, 255];
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

/**
 * Bounds of the content once border rows/columns that are (almost) entirely the
 * given colour are removed. Never returns an empty box.
 */
export function trimBounds(
  data: Uint8ClampedArray | Uint8Array, w: number, h: number, color: RGB, tolerance = 14, outlierShare = 0.01,
): Box {
  const near = (i: number) =>
    Math.abs(data[i] - color[0]) <= tolerance &&
    Math.abs(data[i + 1] - color[1]) <= tolerance &&
    Math.abs(data[i + 2] - color[2]) <= tolerance;
  const rowUniform = (y: number, x0: number, x1: number) => {
    let bad = 0; const limit = Math.floor((x1 - x0) * outlierShare);
    for (let x = x0; x < x1; x++) if (!near((y * w + x) * 4) && ++bad > limit) return false;
    return true;
  };
  const colUniform = (x: number, y0: number, y1: number) => {
    let bad = 0; const limit = Math.floor((y1 - y0) * outlierShare);
    for (let y = y0; y < y1; y++) if (!near((y * w + x) * 4) && ++bad > limit) return false;
    return true;
  };
  let top = 0, bottom = h, left = 0, right = w;
  while (top < bottom - 1 && rowUniform(top, 0, w)) top++;
  while (bottom - 1 > top && rowUniform(bottom - 1, 0, w)) bottom--;
  while (left < right - 1 && colUniform(left, top, bottom)) left++;
  while (right - 1 > left && colUniform(right - 1, top, bottom)) right--;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

/** A gradient that harmonises with the screenshot's edge colour. */
export function autoGradient(edge: RGB): Background {
  const [h, s, l] = rgbToHsl(edge);
  if (s < 0.12) {
    // Neutral screenshots (white/black UIs) get a calm blue-violet backdrop,
    // light or dark to contrast with the content.
    return l > 0.5
      ? { kind: "gradient", from: "#6a85b6", to: "#bac8e0", angle: 135 }
      : { kind: "gradient", from: "#c3cfe2", to: "#f5f7fa", angle: 135 };
  }
  const sat = Math.min(0.85, Math.max(0.55, s));
  return { kind: "gradient", from: hsl(h - 20, sat, 0.62), to: hsl(h + 30, sat, 0.45), angle: 135 };
}
