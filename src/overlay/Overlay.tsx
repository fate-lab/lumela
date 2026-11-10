import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cancelCapture, finishCapture, overlayInfo, overlayPixels, OverlayInfo, Rect } from "../lib/ipc";
import { getT } from "../i18n";

type Mode = "area" | "window";
const DIM = "rgba(0,0,0,0.38)";
const ACCENT = "#f472b6";

/** Full-screen selection over a frozen screenshot of one monitor. */
export default function Overlay() {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let info: OverlayInfo | null = null;
    let mode: Mode = "area";
    let cursor = { x: -1, y: -1 };
    let drag: { x: number; y: number } | null = null;
    let done = false;

    const toImage = (e: MouseEvent) => {
      const sx = info!.width / window.innerWidth;
      const sy = info!.height / window.innerHeight;
      return { x: Math.round(e.clientX * sx), y: Math.round(e.clientY * sy) };
    };

    const hoveredWindow = (): Rect | null =>
      info?.windows.find(
        (w) => cursor.x >= w.rect.x && cursor.y >= w.rect.y && cursor.x < w.rect.x + w.rect.width && cursor.y < w.rect.y + w.rect.height,
      )?.rect ?? null;

    const selection = (): Rect | null => {
      if (mode === "window") return hoveredWindow();
      if (!drag) return null;
      const x = Math.min(drag.x, cursor.x), y = Math.min(drag.y, cursor.y);
      return { x, y, width: Math.abs(cursor.x - drag.x), height: Math.abs(cursor.y - drag.y) };
    };

    const draw = () => {
      const c = fgRef.current;
      if (!c || !info) return;
      const ctx = c.getContext("2d")!;
      const k = info.width / window.innerWidth; // image px per CSS px
      ctx.clearRect(0, 0, c.width, c.height);
      const sel = selection();

      ctx.fillStyle = DIM;
      ctx.beginPath();
      ctx.rect(0, 0, c.width, c.height);
      if (sel && sel.width > 0 && sel.height > 0) ctx.rect(sel.x, sel.y, sel.width, sel.height);
      ctx.fill("evenodd");

      if (mode === "area" && !drag && cursor.x >= 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = k;
        ctx.setLineDash([4 * k, 4 * k]);
        ctx.beginPath();
        ctx.moveTo(cursor.x + 0.5, 0); ctx.lineTo(cursor.x + 0.5, c.height);
        ctx.moveTo(0, cursor.y + 0.5); ctx.lineTo(c.width, cursor.y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (sel && sel.width > 0) {
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2 * k;
        ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
        const label = `${sel.width} × ${sel.height}`;
        ctx.font = `${12 * k}px system-ui, sans-serif`;
        const tw = ctx.measureText(label).width + 12 * k;
        const ly = sel.y > 28 * k ? sel.y - 24 * k : sel.y + 6 * k;
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath();
        ctx.roundRect(sel.x, ly, tw, 20 * k, 4 * k);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(label, sel.x + 6 * k, ly + 14 * k);
      }

      // Hint bar
      const hint = mode === "window"
        ? getT().overlay.windowHint
        : info.windowMode
          ? getT().overlay.areaHint
          : getT().overlay.areaHintNoWindow;
      ctx.font = `${13 * k}px system-ui, sans-serif`;
      const hw = ctx.measureText(hint).width + 28 * k;
      const hx = (c.width - hw) / 2, hy = c.height - 56 * k;
      ctx.fillStyle = "rgba(20,20,24,0.82)";
      ctx.beginPath();
      ctx.roundRect(hx, hy, hw, 32 * k, 16 * k);
      ctx.fill();
      ctx.fillStyle = "#f1f3f5";
      ctx.fillText(hint, hx + 14 * k, hy + 21 * k);
    };

    const finish = (rect: Rect, isWindow: boolean) => {
      if (done) return;
      done = true;
      finishCapture(rect, isWindow).catch(() => cancelCapture());
    };
    const cancel = () => {
      if (done) return;
      done = true;
      cancelCapture();
    };

    const onMove = (e: MouseEvent) => { cursor = toImage(e); draw(); };
    const onDown = (e: MouseEvent) => {
      if (e.button === 2) return cancel();
      if (e.button !== 0) return;
      cursor = toImage(e);
      if (mode === "window") {
        const r = hoveredWindow();
        if (r) finish(r, true);
        return;
      }
      drag = cursor;
      draw();
    };
    const onUp = (e: MouseEvent) => {
      if (e.button !== 0 || mode !== "area" || !drag) return;
      cursor = toImage(e);
      const sel = selection();
      drag = null;
      if (sel && sel.width >= 4 && sel.height >= 4) finish(sel, false);
      else {
        // A plain click captures the window under the cursor.
        const r = hoveredWindow();
        if (r) finish(r, true);
        else draw();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      else if (e.key === " " && info?.windowMode) { mode = mode === "area" ? "window" : "area"; drag = null; draw(); }
      else if (e.key === "Enter" && info) finish({ x: 0, y: 0, width: info.width, height: info.height }, false);
    };
    const onContext = (e: MouseEvent) => e.preventDefault();

    (async () => {
      try {
        info = await overlayInfo();
        mode = info.mode === "window" && info.windowMode ? "window" : "area";
        const src = await overlayPixels(info.width, info.height);
        for (const c of [bgRef.current!, fgRef.current!]) { c.width = info.width; c.height = info.height; }
        bgRef.current!.getContext("2d")!.drawImage(src, 0, 0);
        draw();
        const w = getCurrentWindow();
        await w.show();
        await w.setFocus();
      } catch {
        cancel();
      }
    })();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("resize", draw);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("resize", draw);
    };
  }, []);

  return (
    <div className="overlay">
      <canvas ref={bgRef} />
      <canvas ref={fgRef} />
    </div>
  );
}
