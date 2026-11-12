// Dev-only: lets the editor run in a normal browser (npm run dev) with a synthetic
// screenshot, so the UI can be exercised without the Tauri shell. Never bundled in
// production builds (guarded by import.meta.env.DEV in main.tsx).
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

const W = 1280, H = 800;

function fakeScreenshot(): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#f1f3f5"; g.fillRect(80, 60, W - 160, 56);
  g.fillStyle = "#1f2328"; g.font = "600 28px Segoe UI, sans-serif"; g.fillText("Account settings", 110, 98);
  g.font = "20px Segoe UI, sans-serif";
  const rows = [
    "Email: jane.doe@example.com",
    "Card: 4111 1111 1111 1111",
    "Server IP: 192.168.10.24",
    "API key: sk-live-9fJ2kLm8QpRt5vXz1aBc",
  ];
  rows.forEach((t, i) => g.fillText(t, 110, 190 + i * 64));
  g.fillStyle = "#0a84ff"; g.fillRect(110, 480, 180, 48);
  g.fillStyle = "#fff"; g.fillText("Save", 175, 512);
  return g.getImageData(0, 0, W, H).data;
}

/** Word boxes matching the text drawn by fakeScreenshot (20px Segoe UI ≈ 10px per char). */
function fakeOcr() {
  const rows = ["Email: jane.doe@example.com", "Card: 4111 1111 1111 1111", "Server IP: 192.168.10.24", "API key: sk-live-9fJ2kLm8QpRt5vXz1aBc"];
  return {
    lines: rows.map((text, i) => {
      let x = 110;
      const y = 190 + i * 64 - 18;
      const words = text.split(" ").map((t) => {
        const w = { text: t, x, y, w: t.length * 10, h: 24 };
        x += t.length * 10 + 6;
        return w;
      });
      return { text, words };
    }),
  };
}

export function installBrowserMock() {
  mockWindows(new URLSearchParams(location.search).get("view") ?? "main");
  const pixels = fakeScreenshot();
  let current = { id: 1, width: W, height: H, source: "file", historyId: null as string | null };
  const savedState = JSON.stringify({
    annotations: [{ id: "h1", kind: "arrow", x1: 900, y1: 600, x2: 700, y2: 400, cx: 0, cy: 0, style: "straight", color: "#34c759", width: 6 }],
  });
  let appSettings = { hideAtLaunch: false, hideEditorWhileCapturing: true, keepHistory: true };
  mockIPC(async (cmd, args) => {
    switch (cmd) {
      case "current_info": return current;
      case "history_list": return [{ id: "100-1", created: Date.UTC(2026, 10, 10, 9, 30), source: "area", width: W, height: H }];
      case "history_thumb": {
        const c = document.createElement("canvas");
        c.width = 160; c.height = 100;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels), W, H), 0, 0, 0, 0, 160, 100);
        return await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!)))).arrayBuffer();
      }
      case "history_open": {
        current = { ...current, id: current.id + 1, source: "history", historyId: (args as { id: string }).id };
        const { emit } = await import("@tauri-apps/api/event");
        await emit("image-loaded", current);
        return current;
      }
      case "history_get_state": return current.historyId ? savedState : null;
      case "history_put_state": case "history_delete": return null;
      case "get_app_settings": return appSettings;
      case "set_app_settings": appSettings = (args as { value: typeof appSettings }).value; return null;
      case "plugin:autostart|is_enabled": return false;
      case "current_pixels": return pixels.buffer.slice(0);
      case "default_save_dir": return "C:\\Users\\dev\\Pictures\\Lumela";
      case "get_shortcuts": return { area: "ctrl+shift+Digit2", window: "ctrl+shift+Digit3", fullscreen: "ctrl+shift+Digit1" };
      case "ocr_current": return fakeOcr();
      case "ocr_languages": return [{ tag: "en-US", name: "English (United States)" }];
      case "detect_sensitive": {
        const ocr = fakeOcr();
        const hits = ocr.lines.slice(0, 4).map((l, i) => {
          const w = l.words[l.words.length - 1];
          const first = i === 1 ? l.words[1] : w;
          return { category: ["email", "credit-card", "ip-address", "api-key"][i], x: first.x, y: w.y, w: w.x + w.w - first.x, h: w.h };
        });
        // Single custom words only, compared whole; the real matching is in redact.rs.
        const custom = new Set(((args as { categories?: { customWords?: string[] } }).categories?.customWords ?? [])
          .map((word) => word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase()).filter(Boolean));
        for (const w of ocr.lines.flatMap((l) => l.words)) {
          if (custom.has(w.text.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())) hits.push({ category: "custom-word", x: w.x, y: w.y, w: w.w, h: w.h });
        }
        return hits;
      }
      case "copy_rgba": case "save_bytes": case "set_shortcuts": case "suspend_shortcuts": case "copy_text":
        console.info("[mock]", cmd, args);
        return cmd === "save_bytes" ? "C:\\mock\\saved.png" : null;
      default:
        console.info("[mock] unhandled", cmd, args);
        return null;
    }
  }, { shouldMockEvents: true });
}
