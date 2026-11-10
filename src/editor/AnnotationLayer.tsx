import Konva from "konva";
import { useEffect, useRef } from "react";
import {
  Annotation, ArrowAnn, buildNode, defaultControl, newId, normRect, populate, RenderContext, translate,
} from "../lib/annotations";
import type { Layout } from "../lib/beautify";
import type { ToolStyle } from "../lib/store";

export type Tool = "select" | "arrow" | "text" | "shape" | "redact" | "ocr";

export interface AnnotationLayerProps {
  layout: Layout;
  fit: number;
  /** Size unit of the screenshot (see beautify.unit) used to scale default stroke widths. */
  unit: number;
  annotations: Annotation[];
  rc: RenderContext;
  tool: Tool;
  style: ToolStyle;
  selected: string[];
  editingId: string | null;
  onSelect: (ids: string[]) => void;
  onCommit: (next: Annotation[]) => void;
  onEditText: (id: string, isNew: boolean) => void;
}

const ACCENT = "#db2777";

/**
 * Konva stage laid exactly over the preview canvas, in full-resolution layout
 * coordinates scaled by `fit`. Annotation coordinates are screenshot pixels.
 */
export default function AnnotationLayer(props: AnnotationLayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const k = useRef<{ stage: Konva.Stage; layer: Konva.Layer; ui: Konva.Layer; tr: Konva.Transformer } | null>(null);

  // ------------------------------------------------------------ stage setup + drawing tools
  useEffect(() => {
    const stage = new Konva.Stage({ container: hostRef.current!, width: 1, height: 1 });
    const layer = new Konva.Layer();
    const ui = new Konva.Layer();
    const tr = new Konva.Transformer({
      rotateEnabled: false, ignoreStroke: true, anchorSize: 9, anchorCornerRadius: 2,
      borderStroke: ACCENT, anchorStroke: ACCENT, anchorFill: "#fff", padding: 2,
    });
    ui.add(tr);
    stage.add(layer, ui);
    k.current = { stage, layer, ui, tr };

    const imagePoint = () => {
      const p = stage.getRelativePointerPosition()!;
      const L = propsRef.current.layout;
      return { x: p.x - L.image.x, y: p.y - L.image.y };
    };
    const annotationIdOf = (node: Konva.Node | null): string | null => {
      for (let n = node; n && n !== stage; n = n.getParent()) if (n.hasName("annotation")) return n.id();
      return null;
    };

    let draft: Annotation | null = null;
    let draftNode: Konva.Shape | null = null;
    let start = { x: 0, y: 0 };

    const makeDraft = (p: { x: number; y: number }): Annotation | null => {
      const { tool, style, unit } = propsRef.current;
      const id = newId();
      if (tool === "arrow") {
        return { id, kind: "arrow", x1: p.x, y1: p.y, x2: p.x, y2: p.y, cx: p.x, cy: p.y, style: style.arrowStyle, color: style.arrowColor, width: style.arrowWidth * unit };
      }
      if (tool === "shape") {
        return { id, kind: "shape", shape: style.shapeKind, x: p.x, y: p.y, w: 0, h: 0, color: style.shapeColor, width: style.shapeWidth * unit, filled: style.shapeFilled };
      }
      if (tool === "redact") {
        return { id, kind: "redact", x: p.x, y: p.y, w: 0, h: 0, mode: style.redactMode, color: style.redactColor };
      }
      return null;
    };

    const updateDraft = (p: { x: number; y: number }, shift: boolean) => {
      if (!draft) return;
      if (draft.kind === "arrow") {
        let { x, y } = p;
        if (shift) {
          // Snap to 45° steps.
          const ang = Math.round(Math.atan2(y - start.y, x - start.x) / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(x - start.x, y - start.y);
          x = start.x + Math.cos(ang) * len; y = start.y + Math.sin(ang) * len;
        }
        draft = { ...draft, x2: x, y2: y, ...defaultControl(start.x, start.y, x, y) };
      } else if (draft.kind === "shape" || draft.kind === "redact") {
        let x2 = p.x, y2 = p.y;
        if (shift) {
          const s = Math.max(Math.abs(x2 - start.x), Math.abs(y2 - start.y));
          x2 = start.x + Math.sign(x2 - start.x || 1) * s; y2 = start.y + Math.sign(y2 - start.y || 1) * s;
        }
        draft = { ...draft, ...normRect(start.x, start.y, x2, y2) };
      }
      draftNode?.destroy();
      const group = layer.findOne<Konva.Group>(".annotations");
      // The live preview of a pixel effect is drawn as a plain rectangle while dragging.
      draftNode = group ? buildDraftNode(draft) : null;
      if (draftNode) group!.add(draftNode);
      layer.batchDraw();
    };

    const buildDraftNode = (a: Annotation): Konva.Shape => {
      const node = a.kind === "redact" && a.mode !== "solid"
        ? new Konva.Rect({ x: a.x, y: a.y, width: a.w, height: a.h, fill: "rgba(120,120,120,0.55)" })
        : buildNode(a, null);
      node.listening(false);
      return node;
    };

    stage.on("mousedown touchstart", (e) => {
      const p = propsRef.current;
      if (e.evt instanceof MouseEvent && e.evt.button !== 0) return;
      // Clicks on transformer anchors or arrow handles are handled by those nodes.
      if (e.target.getLayer() === ui) return;
      const hitId = annotationIdOf(e.target);

      if (p.tool === "select") {
        const shift = (e.evt as MouseEvent).shiftKey;
        if (!hitId) p.onSelect([]);
        else if (shift) p.onSelect(p.selected.includes(hitId) ? p.selected.filter((s) => s !== hitId) : [...p.selected, hitId]);
        else if (!p.selected.includes(hitId)) p.onSelect([hitId]);
        return;
      }
      // Text is placed on click (after mouseup), so the new textarea keeps focus.
      if (p.tool === "text") return;
      start = imagePoint();
      draft = makeDraft(start);
      p.onSelect([]);
    });
    stage.on("mousemove touchmove", (e) => {
      if (draft) updateDraft(imagePoint(), (e.evt as MouseEvent).shiftKey);
    });
    const finish = () => {
      if (!draft) return;
      const a = draft;
      draft = null;
      draftNode?.destroy();
      draftNode = null;
      const p = propsRef.current;
      const min = 4 * p.unit;
      const big = a.kind === "arrow" ? Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > min : "w" in a && a.w > min && a.h > min;
      if (big) p.onCommit([...p.annotations, a]);
      else layer.batchDraw();
    };
    stage.on("mouseup touchend", finish);
    const onWindowUp = () => finish();
    window.addEventListener("mouseup", onWindowUp);

    stage.on("click tap", (e) => {
      const p = propsRef.current;
      if (p.tool !== "text" || (e.evt instanceof MouseEvent && e.evt.button !== 0) || e.target.getLayer() === ui) return;
      const hitId = annotationIdOf(e.target);
      const hit = hitId ? p.annotations.find((a) => a.id === hitId) : null;
      if (hit?.kind === "text") { p.onSelect([hit.id]); p.onEditText(hit.id, false); return; }
      const pt = imagePoint();
      const size = p.style.textSize * p.unit;
      const a: Annotation = { id: newId(), kind: "text", x: pt.x, y: pt.y - size * 0.6, text: "", color: p.style.textColor, size };
      p.onCommit([...p.annotations, a]);
      p.onSelect([a.id]);
      p.onEditText(a.id, true);
    });

    stage.on("dblclick dbltap", (e) => {
      const p = propsRef.current;
      const id = annotationIdOf(e.target);
      const a = id ? p.annotations.find((x) => x.id === id) : null;
      if (a?.kind === "text") p.onEditText(a.id, false);
    });

    return () => {
      window.removeEventListener("mouseup", onWindowUp);
      stage.destroy();
      k.current = null;
    };
  }, []);

  // ------------------------------------------------------------ rebuild on prop changes
  useEffect(() => {
    const s = k.current;
    if (!s) return;
    const { layout: L, fit, annotations, rc, tool, selected, editingId } = props;
    const { stage, layer, ui, tr } = s;
    stage.size({ width: L.width * fit, height: L.height * fit });
    stage.scale({ x: fit, y: fit });
    hostRef.current!.style.cursor = tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";

    const group = populate(layer, annotations.filter((a) => a.id !== editingId), L, rc);
    const byId = new Map(annotations.map((a) => [a.id, a]));
    const nodes = group.getChildren() as Konva.Shape[];
    const selectedNodes = nodes.filter((n) => selected.includes(n.id()));

    // ---- dragging (select tool only); moves the whole selection together
    let dragStart = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      n.draggable(tool === "select");
      n.on("mouseenter", () => { if (propsRef.current.tool === "select") hostRef.current!.style.cursor = "move"; });
      n.on("mouseleave", () => { if (propsRef.current.tool === "select") hostRef.current!.style.cursor = "default"; });
      n.on("dragstart", () => {
        const p = propsRef.current;
        const ids = p.selected.includes(n.id()) ? p.selected : [n.id()];
        if (!p.selected.includes(n.id())) p.onSelect(ids);
        dragStart = new Map(nodes.filter((m) => ids.includes(m.id())).map((m) => [m.id(), m.position()]));
      });
      n.on("dragmove", () => {
        const s0 = dragStart.get(n.id());
        if (!s0) return;
        const dx = n.x() - s0.x, dy = n.y() - s0.y;
        for (const [id, pos] of dragStart) {
          if (id !== n.id()) nodes.find((m) => m.id() === id)?.position({ x: pos.x + dx, y: pos.y + dy });
        }
      });
      n.on("dragend", () => {
        const s0 = dragStart.get(n.id());
        if (!s0) return;
        const dx = n.x() - s0.x, dy = n.y() - s0.y;
        const p = propsRef.current;
        p.onCommit(p.annotations.map((a) => (dragStart.has(a.id) ? translate(a, dx, dy) : a)));
      });
    }

    // ---- resize with the transformer (one undo step per resize)
    ui.destroyChildren();
    const transformable = tool === "select" ? selectedNodes.filter((n) => byId.get(n.id())?.kind !== "arrow") : [];
    const onlyText = transformable.length > 0 && transformable.every((n) => byId.get(n.id())?.kind === "text");
    tr.nodes(transformable);
    tr.keepRatio(onlyText);
    const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
    tr.enabledAnchors(onlyText ? corners : [...corners, "top-center", "middle-right", "middle-left", "bottom-center"]);
    tr.off("transformend");
    tr.on("transformend", () => {
      const p = propsRef.current;
      const changed = new Map<string, Annotation>();
      for (const n of tr.nodes()) {
        const a = byId.get(n.id());
        if (!a) continue;
        const sx = n.scaleX(), sy = n.scaleY();
        if (a.kind === "text") changed.set(a.id, { ...a, x: n.x(), y: n.y(), size: Math.max(6, a.size * sy) });
        else if (a.kind === "shape" && a.shape === "ellipse") {
          const rx = (n as Konva.Ellipse).radiusX() * sx, ry = (n as Konva.Ellipse).radiusY() * sy;
          changed.set(a.id, { ...a, x: n.x() - rx, y: n.y() - ry, w: rx * 2, h: ry * 2 });
        } else if (a.kind === "shape" || a.kind === "redact") {
          changed.set(a.id, { ...a, x: n.x(), y: n.y(), w: Math.max(2, n.width() * sx), h: Math.max(2, n.height() * sy) });
        }
        n.scale({ x: 1, y: 1 });
      }
      p.onCommit(p.annotations.map((a) => changed.get(a.id) ?? a));
    });
    ui.add(tr);

    // ---- arrow handles: drag the ends (and the curve) to redirect
    const arrow = tool === "select" && selected.length === 1 ? byId.get(selected[0]) : undefined;
    if (arrow?.kind === "arrow") {
      const node = nodes.find((n) => n.id() === arrow.id) as Konva.Line | undefined;
      const hg = new Konva.Group({ x: L.image.x, y: L.image.y });
      const r = 7 / fit;
      const keys: [keyof ArrowAnn, keyof ArrowAnn][] = [["x1", "y1"], ["x2", "y2"]];
      if (arrow.style === "curved") keys.push(["cx", "cy"]);
      let live = { ...arrow };
      for (const [kx, ky] of keys) {
        const h = new Konva.Circle({
          x: arrow[kx] as number, y: arrow[ky] as number, radius: r, fill: kx === "cx" ? ACCENT : "#fff",
          stroke: ACCENT, strokeWidth: 2 / fit, draggable: true,
        });
        h.on("mouseenter", () => (hostRef.current!.style.cursor = "grab"));
        h.on("mouseleave", () => (hostRef.current!.style.cursor = "default"));
        h.on("dragmove", () => {
          live = { ...live, [kx]: h.x(), [ky]: h.y() };
          node?.points(live.style === "curved" ? [live.x1, live.y1, live.cx, live.cy, live.x2, live.y2] : [live.x1, live.y1, live.x2, live.y2]);
          layer.batchDraw();
        });
        h.on("dragend", () => {
          const p = propsRef.current;
          p.onCommit(p.annotations.map((a) => (a.id === live.id ? live : a)));
        });
        hg.add(h);
      }
      ui.add(hg);
    }

    layer.batchDraw();
    ui.batchDraw();
  }, [props.layout, props.fit, props.annotations, props.rc, props.tool, props.selected, props.editingId]);

  return <div ref={hostRef} className="annotation-layer" />;
}
