import type { Annotation, ArrowStyle, RedactMode, ShapeKind } from "../lib/annotations";
import { PALETTE, ToolStyle, useStore } from "../lib/store";
import type { Tool } from "./AnnotationLayer";
import { useT } from "../i18n";
import type { Dict } from "../i18n/en";

const TOOLS: { id: Tool; label: (t: Dict) => string; key: string }[] = [
  { id: "select", label: (t) => t.tools.select, key: "V" },
  { id: "arrow", label: (t) => t.tools.arrow, key: "1" },
  { id: "text", label: (t) => t.tools.text, key: "2" },
  { id: "redact", label: (t) => t.tools.redact, key: "3" },
  { id: "shape", label: (t) => t.tools.shape, key: "4" },
  { id: "ocr", label: (t) => t.tools.ocr, key: "T" },
];

interface Props {
  tool: Tool;
  setTool: (t: Tool) => void;
  selection: Annotation[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onOrder: (front: boolean) => void;
  /** Applies a style change to the selected annotations (one undo step). */
  onStyleSelection: (patch: Partial<ToolStyle>) => void;
  disabled: boolean;
  /** Text-selection tool state. */
  ocr: { busy: boolean; words: number; selected: number; onCopySelected: () => void; onCopyAll: () => void };
  onAutoRedact: () => void;
  autoRedactBusy: boolean;
}

function Colors({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      {PALETTE.map((c) => (
        <button key={c} className={`dot${c === value ? " active" : ""}`} style={{ background: c }} onClick={() => onChange(c)} title={c} />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} title={useT().tools.customColor} />
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? "active" : ""} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="mini-range">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="num">{value}</span>
    </label>
  );
}

export default function ToolBar(p: Props) {
  const { tools: style, setTools } = useStore();
  const t = useT();
  // Options follow the selection when it is all one kind, otherwise the active tool.
  const kinds = new Set(p.selection.map((a) => (a.kind === "shape" ? "shape" : a.kind)));
  const context: Tool | null = kinds.size === 1 ? ([...kinds][0] as Tool) : p.tool === "select" ? null : p.tool;
  const change = (patch: Partial<ToolStyle>) => {
    setTools(patch);
    if (p.selection.length) p.onStyleSelection(patch);
  };

  return (
    <div className="toolbar2">
      <div className="group">
        {TOOLS.map((tool) => (
          <button
            key={tool.id} disabled={p.disabled} className={p.tool === tool.id ? "active" : ""}
            onClick={() => p.setTool(tool.id)} title={`${tool.label(t)} (${tool.key})`}
          >
            {tool.label(t)}<kbd>{tool.key}</kbd>
          </button>
        ))}
        <span className="sep" />
        <button disabled={!p.canUndo} onClick={p.onUndo} title={t.tools.undo}>↶</button>
        <button disabled={!p.canRedo} onClick={p.onRedo} title={t.tools.redo}>↷</button>
        <span className="sep" />
        <button disabled={!p.selection.length} onClick={() => p.onOrder(true)} title={t.tools.frontHint}>{t.tools.front}</button>
        <button disabled={!p.selection.length} onClick={() => p.onOrder(false)} title={t.tools.backHint}>{t.tools.back}</button>
        <button disabled={!p.selection.length} onClick={p.onDelete} title={t.tools.deleteHint}>{t.tools.delete}</button>
        <span className="sep" />
        <button disabled={p.disabled || p.autoRedactBusy} onClick={p.onAutoRedact} title={t.tools.autoRedactHint}>
          {p.autoRedactBusy ? t.tools.autoRedactBusy : t.tools.autoRedact}
        </button>
      </div>

      <div className="group options">
        {context === "arrow" && (
          <>
            <Segmented<ArrowStyle>
              value={style.arrowStyle} onChange={(arrowStyle) => change({ arrowStyle })}
              options={[["straight", t.tools.arrowStyles.straight], ["curved", t.tools.arrowStyles.curved], ["double", t.tools.arrowStyles.double], ["line", t.tools.arrowStyles.line]]}
            />
            <Range label={t.tools.width} value={style.arrowWidth} min={1} max={20} onChange={(arrowWidth) => change({ arrowWidth })} />
            <Colors value={style.arrowColor} onChange={(arrowColor) => change({ arrowColor })} />
          </>
        )}
        {context === "text" && (
          <>
            <Range label={t.tools.size} value={style.textSize} min={10} max={120} onChange={(textSize) => change({ textSize })} />
            <Colors value={style.textColor} onChange={(textColor) => change({ textColor })} />
          </>
        )}
        {context === "shape" && (
          <>
            <Segmented<ShapeKind>
              value={style.shapeKind} onChange={(shapeKind) => change({ shapeKind })}
              options={[["rect", t.tools.shapes.rect], ["ellipse", t.tools.shapes.ellipse], ["highlight", t.tools.shapes.highlight]]}
            />
            {style.shapeKind !== "highlight" && (
              <>
                <Range label={t.tools.width} value={style.shapeWidth} min={1} max={20} onChange={(shapeWidth) => change({ shapeWidth })} />
                <label className="toggle">
                  <input type="checkbox" checked={style.shapeFilled} onChange={(e) => change({ shapeFilled: e.target.checked })} />
                  <span>{t.tools.filled}</span>
                </label>
              </>
            )}
            <Colors value={style.shapeColor} onChange={(shapeColor) => change({ shapeColor })} />
          </>
        )}
        {p.tool === "ocr" && (
          p.ocr.busy ? <span className="dim">{t.tools.ocrBusy}</span> : (
            <>
              <span className="dim">{t.tools.ocrWords(p.ocr.words)}</span>
              <button disabled={!p.ocr.selected} onClick={p.ocr.onCopySelected} title="Ctrl+C">{t.tools.copySelected(p.ocr.selected)}</button>
              <button disabled={!p.ocr.words} onClick={p.ocr.onCopyAll}>{t.tools.copyAll}</button>
            </>
          )
        )}
        {context === "redact" && (
          <>
            <Segmented<RedactMode>
              value={style.redactMode} onChange={(redactMode) => change({ redactMode })}
              options={[["pixelate", t.tools.redactModes.pixelate], ["blur", t.tools.redactModes.blur], ["solid", t.tools.redactModes.solid]]}
            />
            {style.redactMode === "solid" && <Colors value={style.redactColor} onChange={(redactColor) => change({ redactColor })} />}
          </>
        )}
      </div>
    </div>
  );
}
