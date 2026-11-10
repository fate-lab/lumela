import { useEffect, useRef, useState } from "react";
import type { TextAnn } from "../lib/annotations";
import type { Layout } from "../lib/beautify";

interface Props {
  ann: TextAnn;
  layout: Layout;
  fit: number;
  /** Called with the final text and position; empty text means "remove". */
  onDone: (text: string, x: number, y: number) => void;
  onCancel: () => void;
}

/** In-place textarea over a text annotation. The grip above it drags the text while editing. */
export default function TextEditor({ ann, layout, fit, onDone, onCancel }: Props) {
  const [text, setText] = useState(ann.text);
  const [pos, setPos] = useState({ x: ann.x, y: ann.y });
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const t = ref.current!;
    t.focus();
    t.select();
  }, []);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone(text.replace(/\s+$/, ""), pos.x, pos.y);
  };

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, p0 = pos;
    const move = (m: MouseEvent) => setPos({ x: p0.x + (m.clientX - sx) / fit, y: p0.y + (m.clientY - sy) / fit });
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      ref.current?.focus();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const lines = text.split("\n");
  const fontSize = ann.size * fit;
  return (
    <div
      className="text-editor"
      style={{ left: (layout.image.x + pos.x) * fit, top: (layout.image.y + pos.y) * fit }}
    >
      <div className="grip" onMouseDown={startDrag} title="Drag to move" />
      <textarea
        ref={ref}
        value={text}
        spellCheck={false}
        rows={Math.max(1, lines.length)}
        style={{
          fontSize, color: ann.color, lineHeight: 1.2,
          width: `${Math.max(2, ...lines.map((l) => l.length)) * 0.62 * fontSize + fontSize}px`,
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") { done.current = true; onCancel(); }
          else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(); }
        }}
      />
    </div>
  );
}
