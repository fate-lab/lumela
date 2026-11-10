import { useEffect, useState } from "react";
import { HistoryEntry, historyDelete, historyList, historyOpen, historyThumbUrl } from "../lib/ipc";
import { useT } from "../i18n";


function Thumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    historyThumbUrl(id).then((x) => setUrl((u = x))).catch(() => {});
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return url ? <img src={url} alt="" /> : <div className="thumb-placeholder" />;
}

/** Side drawer listing past screenshots; click to reopen with its edits. */
export default function HistoryDrawer({ onClose, onError }: { onClose: () => void; onError: (m: string) => void }) {
  const t = useT();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  const reload = () => historyList().then(setItems).catch((e) => onError(String(e)));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (id: string) => {
    try { await historyOpen(id); onClose(); } catch (e) { onError(String(e)); }
  };
  const remove = async (id: string) => {
    try { await historyDelete(id); setItems((xs) => xs?.filter((x) => x.id !== id) ?? null); } catch (e) { onError(String(e)); }
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label={t.history.title}>
        <header>
          <h2>{t.history.title}</h2>
          <button onClick={onClose} aria-label={t.common.close}>×</button>
        </header>
        {items === null ? <p className="dim">{t.common.loading}</p>
          : items.length === 0 ? <p className="dim">{t.history.empty}</p>
          : (
            <ul className="history-grid">
              {items.map((it) => (
                <li key={it.id}>
                  <button className="history-item" onClick={() => open(it.id)} title={t.history.open}>
                    <Thumb id={it.id} />
                    <span className="meta">
                      {new Date(it.created).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      {" · "}{t.history.sources[it.source as keyof typeof t.history.sources] ?? it.source} · {it.width}×{it.height}
                    </span>
                  </button>
                  <button className="history-del" onClick={() => remove(it.id)} title={t.history.remove} aria-label={t.history.remove}>×</button>
                </li>
              ))}
            </ul>
          )}
      </aside>
    </div>
  );
}
