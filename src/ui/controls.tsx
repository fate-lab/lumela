export function Slider(props: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { label, value, min, max, onChange } = props;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => e.target.value !== "" && onChange(clamp(+e.target.value))}
      />
    </label>
  );
}

export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle" title={props.hint}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}
