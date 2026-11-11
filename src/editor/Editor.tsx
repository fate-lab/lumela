import { AppWindow, ClipboardPaste, Copy, FolderOpen, GripVertical, History, Monitor, Save, SaveAll, Settings, SquareDashed } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Annotation, applyStyle, drawAnnotations, emptyHistory, historyReducer, newId, RenderContext, reorder, TextAnn,
} from "../lib/annotations";
import { autoGradient, Background, computeLayout, dominantEdgeColor, Layout, trimBounds, unit } from "../lib/beautify";
import {
  copyCanvas, copyText, currentInfo, currentPixels, detectSensitive, ImageInfo, loadClipboardImage, loadImageFile, ocrCurrent,
  OcrResult, readImageFile, saveCanvas, startCapture,
} from "../lib/ipc";
import { hitsToRects, selectedText, wordsInCrop } from "../lib/ocrText";
import { historyGetState, historyPutState, openSettings, screenPermission } from "../lib/ipc";
import PermissionDialog from "./PermissionDialog";
import { playShutter } from "../lib/sound";
import HistoryDrawer from "./HistoryDrawer";
import { getT, useT } from "../i18n";
import TextSelectLayer from "./TextSelectLayer";

/** Editor state kept with each history entry. */
interface SavedState { beautify?: import("../lib/beautify").BeautifySettings; annotations?: Annotation[] }
import { BackgroundImage, render, Source, Watermark } from "../lib/render";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { tempDir, join } from "@tauri-apps/api/path";
import { canSelfUpdate, checkForUpdate, installUpdate, oncePerVersion, UPDATE_CHECK_INTERVAL_MS } from "../lib/updates";
import { useStore } from "../lib/store";
import AnnotationLayer, { Tool } from "./AnnotationLayer";
import Panel from "./Panel";
import TextEditor from "./TextEditor";
import ToolBar from "./ToolBar";

/** Decodes the picture of an image background, keeping the last one cached. */
function useBackgroundImage(bg: Background, onError: (msg: string) => void): BackgroundImage | null {
  const path = bg.kind === "image" ? bg.path : null;
  const [loaded, setLoaded] = useState<{ path: string; img: BackgroundImage } | null>(null);
  useEffect(() => {
    if (!path || loaded?.path === path) return;
    let cancelled = false;
    readImageFile(path)
      .then((img) => !cancelled && setLoaded({ path, img }))
      .catch((e) => !cancelled && onError(String(e)));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return path && loaded?.path === path ? loaded.img : null;
}

interface Loaded {
  info: ImageInfo;
  canvas: HTMLCanvasElement;
  edge: [number, number, number];
  trimmed: Source["crop"];
}

const IMAGE_FILTERS = () => [{ name: getT().common.imageFiles, extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }];

export default function Editor() {
  const { beautify, prefs, tools } = useStore();
  const t = useT();
  const [img, setImg] = useState<Loaded | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean; action?: { label: string; run: () => void } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 2600);
  }, []);

  const loadCurrent = useCallback(async (info: ImageInfo) => {
    const canvas = await currentPixels(info.width, info.height);
    const data = canvas.getContext("2d")!.getImageData(0, 0, info.width, info.height).data;
    const edge = dominantEdgeColor(data, info.width, info.height);
    const trimmed = trimBounds(data, info.width, info.height, edge);

    // Reopened from history: bring back its settings and annotations.
    let saved: SavedState | null = null;
    if (info.historyId && info.source === "history") {
      saved = await historyGetState(info.historyId).then((s) => (s ? (JSON.parse(s) as SavedState) : null)).catch(() => null);
      if (saved?.beautify) useStore.setState({ beautify: saved.beautify, activePresetId: null });
    }
    setImg({ info, canvas, edge, trimmed });
    dispatch({ type: "reset", next: saved?.annotations ?? [] });
    setSelected([]);
    setEditing(null);
    if (useStore.getState().prefs.sounds && ["area", "window", "fullscreen"].includes(info.source)) playShutter();
  }, []);

  const [history, dispatch] = useReducer(historyReducer, emptyHistory);
  const annotations = history.present;
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const commit = useCallback((next: Annotation[]) => dispatch({ type: "commit", next }), []);
  // Keep the history entry's editor state up to date (debounced).
  const historyId = img?.info.historyId ?? null;
  useEffect(() => {
    if (!historyId) return;
    const t = window.setTimeout(() => {
      const state: SavedState = { beautify, annotations };
      historyPutState(historyId, JSON.stringify(state)).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [historyId, beautify, annotations]);

  const [showHistory, setShowHistory] = useState(false);
  const [showPermission, setShowPermission] = useState(false);

  // Look for an update at launch and every few hours after (the app lives in the tray),
  // silently when there is none or offline, and tell about each version only once.
  useEffect(() => {
    if (import.meta.env.DEV) return;
    const isNew = oncePerVersion();
    const look = async () => {
      const s = await checkForUpdate();
      if (s.kind !== "available" || !isNew(s.update.version)) return;
      const self = await canSelfUpdate();
      const t = getT().toast;
      setToast({
        text: t.updateReady(s.update.version),
        action: {
          label: self ? t.updateInstall : t.updateDownload,
          run: () => {
            if (self) setToast({ text: t.updateDownloading });
            installUpdate(s.update).catch((e) => notify(String(e), true));
          },
        },
      });
    };
    look();
    const timer = window.setInterval(look, UPDATE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    screenPermission().then((s) => s === "denied" && setShowPermission(true)).catch(() => {});
  }, []);

  // Test hook for the browser smoke test (dev builds only).
  if (import.meta.env.DEV) (window as unknown as { __scs: unknown }).__scs = { annotations, history, selected, tool };

  // ------------------------------------------------------------ events
  useEffect(() => {
    currentInfo().then((i) => i && loadCurrent(i));
    const unsub = [
      listen<ImageInfo>("image-loaded", (e) => loadCurrent(e.payload)),
      listen<string>("app-error", (e) => notify(e.payload, true)),
      listen("menu-open-file", () => openFile()),
      listen("menu-history", () => setShowHistory(true)),
      listen("permission-needed", () => setShowPermission(true)),
      getCurrentWebview().onDragDropEvent((e) => {
        if (e.payload.type === "over" || e.payload.type === "enter") setDragOver(true);
        else if (e.payload.type === "leave") setDragOver(false);
        else if (e.payload.type === "drop") {
          setDragOver(false);
          const p = e.payload.paths[0];
          if (p) loadImageFile(p).catch((err) => notify(String(err), true));
        }
      }),
    ];
    return () => unsub.forEach((u) => u.then((f) => f()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ------------------------------------------------------------ render
  const source: Source | null = useMemo(() => {
    if (!img) return null;
    const full = { x: 0, y: 0, w: img.info.width, h: img.info.height };
    return {
      canvas: img.canvas,
      crop: beautify.autoBalance ? img.trimmed : full,
      edge: img.edge,
      minRadius: img.info.source === "window" ? 10 : 0,
    };
  }, [img, beautify.autoBalance]);

  const background: Background = useMemo(
    () => (beautify.autoBackground && img ? autoGradient(img.edge) : beautify.background),
    [beautify.autoBackground, beautify.background, img],
  );

  const bgImage = useBackgroundImage(background, (m) => notify(m, true));
  const wm = prefs.watermark;
  const watermark: Watermark | null = useMemo(
    () => (wm.enabled && wm.text.trim() ? { text: wm.text, position: wm.position } : null),
    [wm.enabled, wm.text, wm.position],
  );
  const [view, setView] = useState<{ layout: Layout; fit: number } | null>(null);

  useEffect(() => {
    const c = previewRef.current;
    if (!c || !source) return;
    const L = computeLayout(source.crop.w, source.crop.h, beautify, source.minRadius);
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.max(0.01, Math.min(1, (stageSize.w - 64) / L.width, (stageSize.h - 64) / L.height));
    render(c, source, beautify, background, fit * dpr, bgImage, watermark);
    c.style.width = `${L.width * fit}px`;
    c.style.height = `${L.height * fit}px`;
    setView({ layout: L, fit });
  }, [source, beautify, background, bgImage, watermark, stageSize]);

  const rc: RenderContext | null = useMemo(() => (source ? { source: source.canvas, crop: source.crop } : null), [source]);
  const u = source ? unit(source.crop.w, source.crop.h) : 1;

  const renderFull = useCallback(() => {
    const out = document.createElement("canvas");
    const L = render(out, source!, beautify, background, 1, bgImage, watermark);
    drawAnnotations(out, annotations, L, rc!, 1);
    return out;
  }, [source, beautify, background, bgImage, watermark, annotations, rc]);

  // ------------------------------------------------------------ annotation editing
  const selection = useMemo(() => annotations.filter((a) => selected.includes(a.id)), [annotations, selected]);
  const deleteSelection = () => {
    if (!selected.length) return;
    commit(annotations.filter((a) => !selected.includes(a.id)));
    setSelected([]);
  };
  const order = (front: boolean) => selected.length && commit(reorder(annotations, new Set(selected), front));
  const styleSelection = (patch: Parameters<typeof applyStyle>[1]) =>
    commit(annotations.map((a) => (selected.includes(a.id) ? applyStyle(a, patch, u) : a)));
  const chooseTool = (t: Tool) => {
    setTool(t);
    if (t !== "select") setSelected([]);
  };

  const editingAnn = editing ? (annotations.find((a) => a.id === editing.id) as TextAnn | undefined) : undefined;
  const finishText = (text: string, x: number, y: number) => {
    if (!editing) return;
    const next = text
      ? annotations.map((a) => (a.id === editing.id ? { ...a, text, x, y } : a))
      : annotations.filter((a) => a.id !== editing.id);
    // A new text is one undo step together with its creation.
    dispatch({ type: editing.isNew ? "replace" : "commit", next });
    if (!text) setSelected([]);
    setEditing(null);
  };
  const cancelText = () => {
    if (editing?.isNew) dispatch({ type: "replace", next: annotations.filter((a) => a.id !== editing.id) });
    setEditing(null);
  };

  // ------------------------------------------------------------ OCR: text selection + auto-redact
  const [ocr, setOcr] = useState<{ id: number; result: OcrResult } | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [wordSel, setWordSel] = useState<Set<string>>(new Set());
  const [redactBusy, setRedactBusy] = useState(false);
  const imageId = img?.info.id;
  const ocrFor = ocr && ocr.id === imageId ? ocr.result : null;
  const words = useMemo(() => (ocrFor && source ? wordsInCrop(ocrFor, source.crop) : []), [ocrFor, source]);

  useEffect(() => {
    if (tool !== "ocr" || imageId === undefined || ocrFor || ocrBusy) return;
    setOcrBusy(true);
    ocrCurrent(prefs.ocrLanguage)
      .then((result) => setOcr({ id: imageId, result }))
      .catch((e) => { notify(String(e), true); setTool("select"); })
      .finally(() => setOcrBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, imageId]);
  useEffect(() => setWordSel(new Set()), [imageId]);

  const copyWords = async (all: boolean) => {
    const text = all ? ocrFor!.lines.map((l) => l.text).join("\n") : selectedText(words, wordSel);
    if (!text) return;
    await copyText(text).then(() => notify(all ? t.toast.allTextCopied : t.toast.selectedTextCopied), (e) => notify(String(e), true));
  };

  const autoRedact = async () => {
    if (!source || redactBusy) return;
    setRedactBusy(true);
    try {
      const hits = await detectSensitive(prefs.autoRedact, prefs.ocrLanguage);
      if (hits.length === 0) {
        notify(t.toast.nothingSensitive);
        return;
      }
      const rects = hitsToRects(hits, source.crop, 2 * u);
      const added: Annotation[] = rects.map((r) => ({
        id: newId(), kind: "redact", ...r, mode: tools.redactMode, color: tools.redactColor,
      }));
      commit([...annotations, ...added]);
      setSelected(added.map((a) => a.id));
      setTool("select");
      notify(t.toast.redacted(hits.length));
    } catch (e) {
      notify(String(e), true);
    } finally {
      setRedactBusy(false);
    }
  };

  // Optionally redact as soon as a new image arrives.
  const autoRedactRef = useRef(autoRedact);
  autoRedactRef.current = autoRedact;
  useEffect(() => {
    if (imageId !== undefined && prefs.autoRedactOnLoad) autoRedactRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  // ------------------------------------------------------------ actions
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { notify(String(e), true); } finally { setBusy(false); }
  };

  const copy = () => source && run(async () => {
    await copyCanvas(renderFull());
    notify(t.toast.copied);
    if (prefs.closeAfterCopy) await getCurrentWindow().hide();
  });

  // Holding Alt while saving skips PNG compression.
  const altDown = useRef(false);
  useEffect(() => {
    const track = (e: KeyboardEvent) => { altDown.current = e.altKey; };
    const reset = () => { altDown.current = false; };
    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    window.addEventListener("blur", reset);
    return () => { window.removeEventListener("keydown", track); window.removeEventListener("keyup", track); window.removeEventListener("blur", reset); };
  }, []);
  const compress = () => prefs.compressPng && !altDown.current;

  const quickSave = () => source && run(async () => {
    const path = await saveCanvas(renderFull(), { dir: prefs.saveDir, template: prefs.fileNameTemplate, format: prefs.format, compress: compress() });
    notify(t.toast.saved(path));
  });

  /** Drag the rendered image into another app as a file. */
  const dragOut = () => source && run(async () => {
    const full = renderFull();
    const dir = await join(await tempDir(), "lumela-drag");
    const path = await saveCanvas(full, { dir, template: prefs.fileNameTemplate, format: prefs.format, compress: compress() });
    const icon = document.createElement("canvas");
    const s = 160 / Math.max(full.width, full.height);
    icon.width = Math.round(full.width * s); icon.height = Math.round(full.height * s);
    icon.getContext("2d")!.drawImage(full, 0, 0, icon.width, icon.height);
    const iconPath = await saveCanvas(icon, { path: await join(dir, "drag-icon.png"), format: "png" });
    await startDrag({ item: [path], icon: iconPath });
  });

  const saveAs = () => source && run(async () => {
    const path = await save({
      filters: [prefs.format === "png" ? { name: "PNG", extensions: ["png"] } : { name: "JPEG", extensions: ["jpg", "jpeg"] }],
      defaultPath: `screenshot.${prefs.format === "png" ? "png" : "jpg"}`,
    });
    if (!path) return;
    const format = /\.jpe?g$/i.test(path) ? "jpeg" : "png";
    await saveCanvas(renderFull(), { path, format, compress: compress() });
    notify(t.toast.saved(path));
  });

  async function openFile() {
    const p = await open({ multiple: false, filters: IMAGE_FILTERS() });
    if (typeof p === "string") await loadImageFile(p).catch((e) => notify(String(e), true));
  }

  const paste = () => loadClipboardImage().catch((e) => notify(String(e), true));
  const capture = (m: "area" | "window" | "fullscreen") => startCapture(m).catch((e) => notify(String(e), true));

  // Keyboard shortcuts
  const actions = useRef({
    copy: () => {}, quickSave, saveAs, openFile, paste, deleteSelection, order, chooseTool, hasImage: false, selectAll: () => {},
  });
  actions.current = {
    // With words selected in the text tool, Ctrl+C copies the text instead of the image.
    copy: () => (tool === "ocr" && wordSel.size ? copyWords(false) : copy()),
    quickSave, saveAs, openFile, paste, deleteSelection, order, chooseTool,
    hasImage: !!source, selectAll: () => setSelected(annotations.map((a) => a.id)),
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      const a = actions.current;
      const k = e.key.toLowerCase();
      let handled = true;
      if (e.ctrlKey || e.metaKey) {
        if (k === "c") a.copy();
        else if (k === "s" && e.shiftKey) a.saveAs();
        else if (k === "s") a.quickSave();
        else if (k === "o") a.openFile();
        else if (k === "v") a.paste();
        else if (k === "z" && e.shiftKey) dispatch({ type: "redo" });
        else if (k === "z") dispatch({ type: "undo" });
        else if (k === "y") dispatch({ type: "redo" });
        else if (k === "a" && a.hasImage) { a.chooseTool("select"); a.selectAll(); }
        else handled = false;
      } else if (!a.hasImage || e.altKey) {
        handled = false;
      } else if (e.key === "Delete" || e.key === "Backspace") a.deleteSelection();
      else if (e.key === "Escape" || k === "v") { a.chooseTool("select"); if (e.key === "Escape") setSelected([]); }
      else if (e.code === "Digit1") a.chooseTool("arrow");
      else if (e.code === "Digit2") a.chooseTool("text");
      else if (e.code === "Digit3") a.chooseTool("redact");
      else if (e.code === "Digit4") a.chooseTool("shape");
      else if (k === "t") a.chooseTool("ocr");
      else if (e.key === "]") a.order(true);
      else if (e.key === "[") a.order(false);
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="group">
          <button onClick={() => capture("area")} title="Ctrl+Shift+2"><SquareDashed size={15} aria-hidden />{t.toolbar.area}</button>
          <button onClick={() => capture("window")} title="Ctrl+Shift+3"><AppWindow size={15} aria-hidden />{t.toolbar.window}</button>
          <button onClick={() => capture("fullscreen")} title="Ctrl+Shift+1"><Monitor size={15} aria-hidden />{t.toolbar.fullscreen}</button>
          <span className="sep" />
          <button onClick={openFile} title="Ctrl+O"><FolderOpen size={15} aria-hidden />{t.toolbar.open}</button>
          <button onClick={paste} title="Ctrl+V"><ClipboardPaste size={15} aria-hidden />{t.toolbar.paste}</button>
          <span className="sep" />
          <button onClick={() => setShowHistory(true)} title={t.toolbar.history}><History size={15} aria-hidden />{t.toolbar.history}</button>
          <button onClick={() => openSettings().catch((e) => notify(String(e), true))} title={t.toolbar.settings}><Settings size={15} aria-hidden />{t.toolbar.settings}</button>
        </div>
        <div className="group">
          {source && view && <span className="dim">{view.layout.width} × {view.layout.height}</span>}
          <button className="primary" disabled={!source || busy} onClick={copy} title="Ctrl+C"><Copy size={15} aria-hidden />{t.toolbar.copy}</button>
          <button disabled={!source || busy} onClick={quickSave} title="Ctrl+S"><Save size={15} aria-hidden />{t.toolbar.save}</button>
          <button disabled={!source || busy} onClick={saveAs} title="Ctrl+Shift+S"><SaveAll size={15} aria-hidden />{t.toolbar.saveAs}</button>
          <button
            className="drag-out" disabled={!source || busy} onMouseDown={(e) => { if (e.button === 0) dragOut(); }}
            title={t.toolbar.dragHint}
          ><GripVertical size={15} aria-hidden />{t.toolbar.drag}</button>
        </div>
      </header>
      <ToolBar
        tool={tool} setTool={chooseTool} selection={selection} disabled={!source}
        canUndo={history.past.length > 0} canRedo={history.future.length > 0}
        onUndo={() => dispatch({ type: "undo" })} onRedo={() => dispatch({ type: "redo" })}
        onDelete={deleteSelection} onOrder={order} onStyleSelection={styleSelection}
        ocr={{ busy: ocrBusy, words: words.length, selected: wordSel.size, onCopySelected: () => copyWords(false), onCopyAll: () => copyWords(true) }}
        onAutoRedact={autoRedact} autoRedactBusy={redactBusy}
      />

      <main className="workspace">
        <div ref={stageRef} className={`stage${dragOver ? " drag" : ""}`}>
          {source ? (
            <div className="canvas-wrap">
              <canvas ref={previewRef} className="preview" />
              {view && rc && (
                <AnnotationLayer
                  layout={view.layout} fit={view.fit} unit={u} annotations={annotations} rc={rc}
                  tool={tool} style={tools} selected={selected} editingId={editing?.id ?? null}
                  onSelect={setSelected} onCommit={commit}
                  onEditText={(id, isNew) => setEditing({ id, isNew })}
                />
              )}
              {view && tool === "ocr" && (
                <TextSelectLayer layout={view.layout} fit={view.fit} words={words} selected={wordSel} onSelect={setWordSel} />
              )}
              {view && editingAnn && (
                <TextEditor key={editingAnn.id} ann={editingAnn} layout={view.layout} fit={view.fit} onDone={finishText} onCancel={cancelText} />
              )}
            </div>
          ) : (
            <div className="empty">
              <img className="empty-logo" src="/lumela.svg" alt="" width={96} height={96} />
              <h1>{t.empty.title}</h1>
              <dl>
                <dt>Ctrl+Shift+2</dt><dd>{t.empty.area}</dd>
                <dt>Ctrl+Shift+3</dt><dd>{t.empty.window}</dd>
                <dt>Ctrl+Shift+1</dt><dd>{t.empty.fullscreen}</dd>
                <dt>Ctrl+V / Ctrl+O</dt><dd>{t.empty.paste}</dd>
              </dl>
            </div>
          )}
        </div>
        <Panel edgeBackground={img ? autoGradient(img.edge) : null} onError={(m) => notify(m, true)} />
      </main>

      {showPermission && <PermissionDialog onClose={() => setShowPermission(false)} />}
      {showHistory && <HistoryDrawer onClose={() => setShowHistory(false)} onError={(m) => notify(m, true)} />}
      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`}>
          {toast.text}
          {toast.action && <button className="toast-action" onClick={toast.action.run}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  );
}
