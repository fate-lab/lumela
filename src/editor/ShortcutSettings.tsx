import { useEffect, useState } from "react";
import { getShortcuts, setShortcuts, ShortcutError, Shortcuts, suspendShortcuts } from "../lib/ipc";
import { display, fromEvent } from "../lib/shortcut";
import { useT } from "../i18n";

const KEYS: (keyof Shortcuts)[] = ["area", "window", "fullscreen"];
const DEFAULTS: Shortcuts = { area: "ctrl+shift+Digit2", window: "ctrl+shift+Digit3", fullscreen: "ctrl+shift+Digit1" };

export default function ShortcutSettings() {
  const t = useT();
  const [current, setCurrent] = useState<Shortcuts | null>(null);
  const [recording, setRecording] = useState<keyof Shortcuts | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Shortcuts, string>>>({});

  useEffect(() => { getShortcuts().then(setCurrent).catch(() => {}); }, []);

  const apply = async (next: Shortcuts) => {
    try {
      await setShortcuts(next);
      setCurrent(next);
      setErrors({});
    } catch (e) {
      const list = Array.isArray(e) ? (e as ShortcutError[]) : [];
      setErrors(Object.fromEntries(list.map((x) => [x.action, x.message])));
      if (list.length === 0) setErrors({ area: String(e) });
    }
  };

  useEffect(() => {
    if (!recording || !current) return;
    suspendShortcuts(true);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setRecording(null);
        return;
      }
      const combo = fromEvent(e);
      if (!combo) return;
      setRecording(null);
      apply({ ...current, [recording]: combo });
    };
    const stop = () => setRecording(null);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", stop);
      // set_shortcuts re-registers on success; this restores them after cancel or failure.
      suspendShortcuts(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  if (!current) return null;
  return (
    <section>
      <h2>{t.shortcuts.title}</h2>
      {KEYS.map((k) => (
        <div key={k} className="shortcut">
          <span>{t.shortcuts[k]}</span>
          <button
            className={`recorder${recording === k ? " recording" : ""}${errors[k] ? " invalid" : ""}`}
            onClick={() => setRecording(recording === k ? null : k)}
            title={t.shortcuts.recordHint}
          >
            {recording === k ? t.shortcuts.recording : display(current[k])}
          </button>
          {errors[k] && <small className="error">{errors[k]}</small>}
        </div>
      ))}
      <button className="link" onClick={() => apply(DEFAULTS)}>{t.shortcuts.defaults}</button>
    </section>
  );
}
