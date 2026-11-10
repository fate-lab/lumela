# Lumela brand

Lumela follows the Buzzspire product family style (buzzspire.net): a dark base, one bright
signature hue per product, a glossy tile lit from the top-left, and a simple round-capped
line glyph in a deep tint of that hue.

| Product | Hue |
|---|---|
| Nexar | violet `#8b5cf6` → `#b49bff` |
| Waggle | amber `#f5b31f` → `#ffd978` |
| Skep | sky `#6cc4ff` → `#b3e3ff` |
| Forager | green `#3ddc97` → `#a6f5cf` |
| **Lumela** | **rose `#f472b6` → `#ffb3d9`**, glyph `#2a0717` |

Glyph: viewfinder corners + a sparkle, "capture, then make it shine".

| File | Use |
|---|---|
| `lumela-icon.svg` | master (app icons, favicon, README); regenerate icons with `npx tauri icon branding/lumela-icon.svg` (delete the android/ios folders it adds) |
| `lumela-icon-small.svg` | 16–32 px (tray); rendered to `src-tauri/icons/tray.png` |

UI accent: `#db2777` on light, `#ec4899` on dark (white text passes contrast).
Dark UI palette: background `#0f0f14`, text `#ededf3`, muted `#8d8d9e`.
