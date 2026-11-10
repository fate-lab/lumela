import { describe, expect, it } from "vitest";
import {
  Annotation, applyStyle, bounds, defaultControl, emptyHistory, historyReducer, normRect, reorder, translate,
} from "./annotations";

const rect = (id: string): Annotation => ({ id, kind: "shape", shape: "rect", x: 0, y: 0, w: 10, h: 10, color: "#f00", width: 2, filled: false });

describe("geometry", () => {
  it("normalises rectangles drawn in any direction", () => {
    expect(normRect(10, 20, 4, 5)).toEqual({ x: 4, y: 5, w: 6, h: 15 });
  });
  it("puts the curve control beside the midpoint", () => {
    expect(defaultControl(0, 0, 100, 0)).toEqual({ cx: 50, cy: 20 });
  });
  it("translates arrows including the control point", () => {
    const a: Annotation = { id: "a", kind: "arrow", x1: 0, y1: 0, x2: 10, y2: 0, cx: 5, cy: 2, style: "curved", color: "#000", width: 2 };
    expect(translate(a, 3, 4)).toMatchObject({ x1: 3, y1: 4, x2: 13, y2: 4, cx: 8, cy: 6 });
    expect(bounds(a)).toEqual({ x: 0, y: 0, w: 10, h: 2 });
  });
});

describe("history", () => {
  it("undoes and redoes commits", () => {
    let h = historyReducer(emptyHistory, { type: "commit", next: [rect("a")] });
    h = historyReducer(h, { type: "commit", next: [rect("a"), rect("b")] });
    h = historyReducer(h, { type: "undo" });
    expect(h.present.map((a) => a.id)).toEqual(["a"]);
    h = historyReducer(h, { type: "redo" });
    expect(h.present.map((a) => a.id)).toEqual(["a", "b"]);
  });
  it("drops the redo stack on a new commit and ignores undo at the start", () => {
    let h = historyReducer(emptyHistory, { type: "commit", next: [rect("a")] });
    h = historyReducer(h, { type: "undo" });
    h = historyReducer(h, { type: "commit", next: [rect("c")] });
    expect(h.future).toEqual([]);
    expect(historyReducer(emptyHistory, { type: "undo" })).toBe(emptyHistory);
  });
});

describe("applyStyle", () => {
  it("scales widths by the unit and only touches given fields", () => {
    const r = applyStyle(rect("a"), { shapeWidth: 3, shapeColor: "#00f" }, 2);
    expect(r).toMatchObject({ width: 6, color: "#00f", shape: "rect", filled: false });
  });
  it("gives an arrow a bend when switched to curved", () => {
    const a: Annotation = { id: "a", kind: "arrow", x1: 0, y1: 0, x2: 100, y2: 0, cx: 0, cy: 0, style: "straight", color: "#000", width: 2 };
    expect(applyStyle(a, { arrowStyle: "curved" }, 1)).toMatchObject({ style: "curved", cx: 50, cy: 20 });
  });
  it("ignores fields of other kinds", () => {
    const t: Annotation = { id: "t", kind: "text", x: 0, y: 0, text: "hi", color: "#000", size: 20 };
    expect(applyStyle(t, { arrowColor: "#f00" }, 1)).toEqual(t);
  });
});

describe("reorder", () => {
  it("moves selection to front or back", () => {
    const list = ["a", "b", "c"].map(rect);
    expect(reorder(list, new Set(["a"]), true).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(reorder(list, new Set(["c"]), false).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});
