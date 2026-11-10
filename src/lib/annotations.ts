import Konva from "konva";
import type { Box, Layout } from "./beautify";
import type { ToolStyle } from "./store";

// Annotation model. Coordinates are screenshot pixels relative to the (balanced) crop,
// so annotations stay on their content when padding, inset or ratio change.

export type ArrowStyle = "straight" | "curved" | "line" | "double";
export type ShapeKind = "rect" | "ellipse" | "highlight";
export type RedactMode = "solid" | "pixelate" | "blur";

interface Base { id: string }
export interface ArrowAnn extends Base {
  kind: "arrow"; x1: number; y1: number; x2: number; y2: number;
  /** Control point for curved arrows. */
  cx: number; cy: number;
  style: ArrowStyle; color: string; width: number;
}
export interface ShapeAnn extends Base {
  kind: "shape"; shape: ShapeKind; x: number; y: number; w: number; h: number; color: string; width: number; filled: boolean;
}
export interface TextAnn extends Base { kind: "text"; x: number; y: number; text: string; color: string; size: number }
export interface RedactAnn extends Base { kind: "redact"; x: number; y: number; w: number; h: number; mode: RedactMode; color: string }
export type Annotation = ArrowAnn | ShapeAnn | TextAnn | RedactAnn;

/** Pixels the redact effects read from. */
export interface RenderContext { source: CanvasImageSource & { width: number; height: number }; crop: Box }

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Default control point: the midpoint pushed sideways by 20% of the length. */
export function defaultControl(x1: number, y1: number, x2: number, y2: number): { cx: number; cy: number } {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return { cx: mx - (y2 - y1) * 0.2, cy: my + (x2 - x1) * 0.2 };
}

/** Rectangle from two corner points, with positive size. */
export function normRect(x1: number, y1: number, x2: number, y2: number) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

/** Bounding box of an annotation (text uses an estimate). */
export function bounds(a: Annotation): Box {
  switch (a.kind) {
    case "arrow": {
      const xs = [a.x1, a.x2, ...(a.style === "curved" ? [a.cx] : [])];
      const ys = [a.y1, a.y2, ...(a.style === "curved" ? [a.cy] : [])];
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case "text": {
      const lines = a.text.split("\n");
      return { x: a.x, y: a.y, w: Math.max(...lines.map((l) => l.length)) * a.size * 0.6, h: lines.length * a.size * 1.2 };
    }
    default:
      return { x: a.x, y: a.y, w: a.w, h: a.h };
  }
}

/** Moves an annotation by (dx, dy). */
export function translate(a: Annotation, dx: number, dy: number): Annotation {
  if (a.kind === "arrow") return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy, cx: a.cx + dx, cy: a.cy + dy };
  return { ...a, x: a.x + dx, y: a.y + dy };
}

function redactCanvas(a: RedactAnn, rc: RenderContext): HTMLCanvasElement {
  const w = Math.max(1, Math.round(a.w)), h = Math.max(1, Math.round(a.h));
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const ctx = out.getContext("2d")!;
  const sx = rc.crop.x + a.x, sy = rc.crop.y + a.y;
  if (a.mode === "pixelate") {
    const block = Math.max(6, Math.round(Math.min(w, h) / 6), Math.round(Math.max(rc.crop.w, rc.crop.h) / 160));
    const tw = Math.max(1, Math.ceil(w / block)), th = Math.max(1, Math.ceil(h / block));
    const tiny = document.createElement("canvas");
    tiny.width = tw; tiny.height = th;
    const t = tiny.getContext("2d")!;
    t.imageSmoothingEnabled = true;
    t.drawImage(rc.source, sx, sy, a.w, a.h, 0, 0, tw, th);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, tw, th, 0, 0, w, h);
  } else {
    const r = Math.max(6, Math.round(Math.min(w, h) / 4));
    // Fill first so the blurred edges never show transparency.
    ctx.fillStyle = a.color;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = `blur(${r}px)`;
    ctx.drawImage(rc.source, sx - r, sy - r, a.w + 2 * r, a.h + 2 * r, -r, -r, w + 2 * r, h + 2 * r);
  }
  return out;
}

/** Builds the Konva node for one annotation. Shared by the live editor and export. */
export function buildNode(a: Annotation, rc: RenderContext | null): Konva.Shape {
  const common = { id: a.id, name: "annotation" };
  switch (a.kind) {
    case "arrow": {
      const pts = a.style === "curved" ? [a.x1, a.y1, a.cx, a.cy, a.x2, a.y2] : [a.x1, a.y1, a.x2, a.y2];
      const head = a.width * 3.4;
      const cfg = {
        ...common, points: pts, stroke: a.color, fill: a.color, strokeWidth: a.width,
        tension: a.style === "curved" ? 0.5 : 0, lineCap: "round" as const, lineJoin: "round" as const, hitStrokeWidth: Math.max(16, a.width * 3),
      };
      if (a.style === "line") return new Konva.Line(cfg);
      return new Konva.Arrow({ ...cfg, pointerLength: head, pointerWidth: head, pointerAtBeginning: a.style === "double" });
    }
    case "shape": {
      if (a.shape === "highlight") {
        return new Konva.Rect({ ...common, x: a.x, y: a.y, width: a.w, height: a.h, fill: a.color, opacity: 0.35, cornerRadius: 2 });
      }
      const fill = a.filled ? a.color : undefined;
      // Hollow shapes are hit only on their outline; widen it so they are easy to grab.
      const hitStrokeWidth = Math.max(14, a.width * 3);
      if (a.shape === "ellipse") {
        return new Konva.Ellipse({
          ...common, x: a.x + a.w / 2, y: a.y + a.h / 2, radiusX: a.w / 2, radiusY: a.h / 2,
          stroke: a.color, strokeWidth: a.width, fill, hitStrokeWidth,
        });
      }
      return new Konva.Rect({
        ...common, x: a.x, y: a.y, width: a.w, height: a.h, stroke: a.color, strokeWidth: a.width, fill, cornerRadius: a.width, hitStrokeWidth,
      });
    }
    case "text":
      return new Konva.Text({
        ...common, x: a.x, y: a.y, text: a.text || " ", fill: a.color, fontSize: a.size, lineHeight: 1.2,
        fontFamily: "Segoe UI, system-ui, sans-serif", fontStyle: "600",
        shadowColor: "rgba(0,0,0,0.25)", shadowBlur: a.size * 0.15, shadowOffsetY: a.size * 0.04,
      });
    case "redact":
      if (a.mode === "solid" || !rc) {
        return new Konva.Rect({ ...common, x: a.x, y: a.y, width: a.w, height: a.h, fill: a.color });
      }
      return new Konva.Image({ ...common, x: a.x, y: a.y, width: a.w, height: a.h, image: redactCanvas(a, rc) });
  }
}

/** Fills `layer` with the annotations, placed at the screenshot's position in the layout. */
export function populate(layer: Konva.Layer, annotations: Annotation[], L: Layout, rc: RenderContext | null): Konva.Group {
  layer.destroyChildren();
  const group = new Konva.Group({ x: L.image.x, y: L.image.y, name: "annotations" });
  for (const a of annotations) group.add(buildNode(a, rc));
  layer.add(group);
  return group;
}

/** Draws the annotations onto an already rendered composite (`target` is L × scale pixels). */
export function drawAnnotations(target: HTMLCanvasElement, annotations: Annotation[], L: Layout, rc: RenderContext, scale = 1) {
  if (annotations.length === 0) return;
  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, width: L.width, height: L.height });
  try {
    const layer = new Konva.Layer();
    stage.add(layer);
    populate(layer, annotations, L, rc);
    const ctx = target.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer.toCanvas({ pixelRatio: scale }), 0, 0, target.width, target.height);
    ctx.restore();
  } finally {
    stage.destroy();
  }
}

// ------------------------------------------------------------------ history

export interface History { past: Annotation[][]; present: Annotation[]; future: Annotation[][] }
export type HistoryAction =
  | { type: "commit"; next: Annotation[] }
  /** Changes the present without a new undo step (e.g. typing into a text just created). */
  | { type: "replace"; next: Annotation[] }
  | { type: "undo" } | { type: "redo" } | { type: "reset"; next: Annotation[] };

export const emptyHistory: History = { past: [], present: [], future: [] };

export function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case "commit":
      if (a.next === h.present) return h;
      return { past: [...h.past, h.present].slice(-200), present: a.next, future: [] };
    case "replace":
      return { ...h, present: a.next };
    case "undo":
      if (h.past.length === 0) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    case "redo":
      if (h.future.length === 0) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    case "reset":
      return { past: [], present: a.next, future: [] };
  }
}

/** Applies tool style changes to an existing annotation. `unit` scales reference widths. */
export function applyStyle(a: Annotation, s: Partial<ToolStyle>, unit: number): Annotation {
  switch (a.kind) {
    case "arrow": {
      const next = {
        ...a,
        color: s.arrowColor ?? a.color,
        width: s.arrowWidth !== undefined ? s.arrowWidth * unit : a.width,
        style: s.arrowStyle ?? a.style,
      };
      // Switching to curved starts from a gentle default bend.
      if (s.arrowStyle === "curved" && a.style !== "curved") Object.assign(next, defaultControl(a.x1, a.y1, a.x2, a.y2));
      return next;
    }
    case "text":
      return { ...a, color: s.textColor ?? a.color, size: s.textSize !== undefined ? s.textSize * unit : a.size };
    case "shape":
      return {
        ...a,
        shape: s.shapeKind ?? a.shape,
        color: s.shapeColor ?? a.color,
        width: s.shapeWidth !== undefined ? s.shapeWidth * unit : a.width,
        filled: s.shapeFilled ?? a.filled,
      };
    case "redact":
      return { ...a, mode: s.redactMode ?? a.mode, color: s.redactColor ?? a.color };
  }
}

/** Moves the given ids to the front (end of the list) or back (start). */
export function reorder(list: Annotation[], ids: Set<string>, toFront: boolean): Annotation[] {
  const picked = list.filter((a) => ids.has(a.id));
  const rest = list.filter((a) => !ids.has(a.id));
  return toFront ? [...rest, ...picked] : [...picked, ...rest];
}
