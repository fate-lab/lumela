import { useState } from "react";
import { useStore } from "../lib/store";
import { useT } from "../i18n";

/** Save, apply and delete beautify presets. */
export default function PresetBar() {
  const { presets, activePresetId, savePreset, applyPreset, deletePreset } = useStore();
  const t = useT();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const commit = () => {
    const n = name.trim();
    if (n) savePreset(n);
    setNaming(false);
    setName("");
  };

  return (
    <section>
      <h2>{t.panel.presets}</h2>
      {presets.length > 0 && (
        <div className="presets">
          {presets.map((p) => (
            <span key={p.id} className={`preset${p.id === activePresetId ? " active" : ""}`}>
              <button onClick={() => applyPreset(p.id)} title={t.panel.apply}>{p.name}</button>
              <button className="x" onClick={() => deletePreset(p.id)} title={t.panel.remove} aria-label={`${t.panel.remove} ${p.name}`}>×</button>
            </span>
          ))}
        </div>
      )}
      {naming ? (
        <div className="row">
          <input
            className="preset-name" autoFocus placeholder={t.panel.presetName} value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setNaming(false); }}
          />
          <button className="primary" onClick={commit} disabled={!name.trim()}>{t.panel.savePreset}</button>
        </div>
      ) : (
        <button onClick={() => setNaming(true)}>{t.panel.saveCurrent}</button>
      )}
    </section>
  );
}
