# Architecture

Lumela is a [Tauri 2](https://tauri.app) app: a Rust core does everything that touches the
operating system, and a React + TypeScript web UI does editing and rendering.

## Why Tauri

- Small installers (~10 MB) and low memory use; uses the system WebView (WebView2 on Windows).
- The annotation layer (arrows, text, shapes, redaction) is easiest to build on a web canvas.
- OS-specific work (capture, shortcuts, tray, OCR) stays in Rust with a native backend per platform.

## Layers

```
┌──────────────────────── Rust core (src-tauri/src) ─────────────────────┐
│ capture.rs     freeze the monitor under the cursor (xcap), window list │
│                (z-order) for window mode; Wayland via xdg-desktop-portal│
│ shortcuts.rs   user-configurable global shortcuts (persisted)          │
│ ocr/           trait OcrEngine                                         │
│                  windows → Windows.Media.Ocr                           │
│                  macos   → Vision (VNRecognizeTextRequest)             │
│                  linux   → tesseract CLI (TSV parser)                  │
│ redact.rs      emails, Luhn cards, IPv4/IPv6, API keys, custom words   │
│ export.rs      clipboard, file naming, lossless PNG optimisation       │
│ history.rs     captures + editor state under the app data dir          │
│ settings.rs    app-level settings; permissions.rs (macOS recording)    │
│ lib.rs         commands, tray, overlay window, updater                 │
└──────────────────────────────── IPC (invoke / events) ─────────────────┘
┌──────────────────────── Web UI (src) ──────────────────────────────────┐
│ overlay/       area / window selection on the frozen screenshot        │
│ editor/        preview, Konva annotation layer, tools, panels          │
│ lib/beautify   layout, edge colour, auto-balance, auto gradient (pure) │
│ lib/render     Canvas 2D: background → card → screenshot → watermark   │
│ lib/annotations model, Konva nodes, undo/redo history (pure)           │
│ settings/      settings window                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## Data flow

1. Shortcut or tray → `begin_capture` freezes the monitor under the cursor.
2. Area/window mode opens the overlay; the selection is cropped in Rust and the editor is shown.
3. The editor fetches raw RGBA pixels (no PNG round trip), applies auto-balance and the
   beautify settings, and renders the preview at screen scale.
4. Copy / Save render the same pipeline at full resolution and hand the pixels back to Rust.

## Platform notes

| Topic | Windows | macOS | Linux |
|---|---|---|---|
| Capture | xcap (DXGI/GDI) | xcap + Screen Recording permission | xcap (X11 / Wayland portal) |
| Window mode | yes | yes | X11 only |
| OCR | Windows.Media.Ocr | Vision | tesseract (`tesseract-ocr`) |
| Clipboard | arboard | arboard | arboard |
| Launch at login | tauri-plugin-autostart | same | same |

## Tests

- `npm test` — Vitest (layout, colour, annotations, history, presets, OCR helpers, release scripts)
- `cd src-tauri && cargo test` — Rust (capture geometry, export, history, shortcuts, redaction,
  real OCR on `tests/fixtures/sensitive.png` with the platform engine)
- `npm run dev` + `npm run e2e` — headless browser smoke test against a dev-only Tauri mock
