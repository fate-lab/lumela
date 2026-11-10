import { useRef, useState } from "react";
import type { Box, Layout } from "../lib/beautify";
import { IndexedWord, intersects, key } from "../lib/ocrText";

interface Props {
  layout: Layout;
  fit: number;
  words: IndexedWord[];
  selected: Set<string>;
  onSelect: (s: Set<string>) => void;
}

/** Recognised words as selectable boxes over the preview. Drag to select a range, click to toggle. */
export default function TextSelectLayer({ layout, fit, words, selected, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [band, setBand] = useState<Box | null>(null);
  const toScreen = (b: Box) => ({
    left: (layout.image.x + b.x) * fit, top: (layout.image.y + b.y) * fit, width: b.w * fit, height: b.h * fit,
  });

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const r = ref.current!.getBoundingClientRect();
    const toImage = (cx: number, cy: number) => ({ x: (cx - r.left) / fit - layout.image.x, y: (cy - r.top) / fit - layout.image.y });
    const start = toImage(e.clientX, e.clientY);
    const additive = e.shiftKey || e.ctrlKey;
    const base = additive ? new Set(selected) : new Set<string>();
    let moved = false;
    const move = (m: MouseEvent) => {
      const p = toImage(m.clientX, m.clientY);
      const b = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      moved = moved || b.w > 3 / fit || b.h > 3 / fit;
      if (!moved) return;
      setBand(b);
      const next = new Set(base);
      for (const w of words) if (intersects(w.box, b)) next.add(key(w));
      onSelect(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setBand(null);
      if (!moved) {
        const hit = words.find((w) => intersects(w.box, { x: start.x, y: start.y, w: 0.01, h: 0.01 }));
        const next = new Set(base);
        if (hit) (selected.has(key(hit)) && additive ? next.delete(key(hit)) : next.add(key(hit)));
        onSelect(next);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div ref={ref} className="text-select-layer" onMouseDown={onMouseDown}>
      {words.map((w) => (
        <div key={key(w)} className={`ocr-word${selected.has(key(w)) ? " selected" : ""}`} style={toScreen(w.box)} title={w.text} />
      ))}
      {band && <div className="ocr-band" style={toScreen(band)} />}
    </div>
  );
}
