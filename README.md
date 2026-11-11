<p align="center">
  <img src="branding/lumela-icon.svg" width="112" height="112" alt="Lumela logo">
</p>

<h1 align="center">Lumela</h1>

<p align="center">
  <b>CleanShot-style screenshots for Windows, macOS and Linux.</b><br>
  Capture, auto-beautify, annotate and share. Emails, card numbers, IPs and API keys are blurred automatically.<br>
  Free and open source.
</p>

<p align="center">
  English · <a href="README.tr.md">Türkçe</a> · <a href="README.de.md">Deutsch</a> · <a href="README.es.md">Español</a> · <a href="README.ru.md">Русский</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/tw4/lumela/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/tw4/lumela?display_name=tag&sort=semver&color=db2777"></a>
  <a href="https://github.com/tw4/lumela/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/tw4/lumela/total?color=db2777"></a>
  <a href="https://github.com/tw4/lumela/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/tw4/lumela/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555">
  <a href="https://tauri.app"><img alt="Built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri%202-24c8db"></a>
</p>

<p align="center">
  <a href="#download">Download</a> ·
  <a href="#features">Features</a> ·
  <a href="#keyboard-shortcuts">Shortcuts</a> ·
  <a href="#build-from-source">Build</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <img src="docs/demo.gif" alt="Lumela beautifying a screenshot, redacting an email, card number, IP address and API key in one click, adding an arrow and text, then copying the result" width="900">
</p>

## Why Lumela?

A raw screenshot rarely looks good enough to share. Lumela turns it into a polished image in one step: a matching background, balanced padding, rounded corners and a soft shadow. Arrows and text explain it, and sensitive data is blurred before anyone sees it.

- **Everything is free.** No accounts, no subscriptions, no watermark.
- **Private by design.** Capture, text recognition and redaction run on your device. Nothing is uploaded.
- **Fast.** Native capture and a small installer (about 4 MB on Windows, 12 MB on macOS).
- **Same app everywhere.** Windows, macOS and Linux get the same editor, shortcuts and features.

If Lumela saves you some manual blurring, a ⭐ on GitHub helps other people find it.

## Download

Get the installer for your system from the [latest release](https://github.com/tw4/lumela/releases/latest):

| System | File |
|---|---|
| Windows 10 / 11 (x64) | `Lumela_<version>_x64-setup.exe` or `.msi` |
| macOS 10.15+ (Apple silicon and Intel) | `Lumela_<version>_universal.dmg` |
| Linux (x64): Ubuntu 24.04+, Debian 13+, Fedora 40+ or similar | `Lumela_<version>_amd64.AppImage` or `.deb` |

Or install it with a package manager:

```bash
brew trust tw4/tap && brew install --cask tw4/tap/lumela                             # macOS (Homebrew)
scoop install https://raw.githubusercontent.com/tw4/lumela/main/packaging/scoop/lumela.json   # Windows (Scoop)
```

winget (`tw4.Lumela`) is under review in [microsoft/winget-pkgs#476618](https://github.com/microsoft/winget-pkgs/pull/476618).

Lumela checks for new versions in the background and offers a one-click update: it downloads, checks the signature, installs and restarts, so there is nothing to uninstall or download again. On Linux this works with the AppImage; with the `.deb` the update button opens the release page.

> [!NOTE]
> Installers are not code-signed yet, so the operating system warns on first launch.
>
> **Windows:** *More info* → *Run anyway*.
>
> **macOS 15 and later:** open Lumela once and close the warning, then go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to the Lumela message. On macOS 14 and earlier, right-click the app → *Open* is enough. Installing with Homebrew skips this step.
>
> **Linux:** the `.deb` installs `tesseract-ocr` for text recognition. With the AppImage, install it yourself (`sudo apt install tesseract-ocr`, `sudo dnf install tesseract` or `sudo pacman -S tesseract tesseract-data-eng`).

## Features

| | |
|---|---|
| **Capture** | Area, window (press <kbd>Space</kbd> while capturing) or full screen, with global shortcuts and a tray menu. Multi-monitor. Open from a file, the clipboard or drag and drop. |
| **Beautify** | Automatic background from the screenshot's edge colour, auto-balance, gradients, solid colours, your own image or desktop wallpaper, padding, inset, corner radius and shadow. |
| **Sizes** | Free, 1:1, 4:3, 3:2, 16:9, 9:16 and presets for X/Twitter, Instagram, LinkedIn, Facebook and YouTube. |
| **Annotate** | Arrows (straight, curved, double, line), text, rectangles, ellipses and highlights. Move, resize, layer order and undo/redo. |
| **Redact** | Pixelate, blur or solid boxes. **Auto redact** finds emails, credit card numbers, IP addresses and API keys in one click. |
| **Copy text** | On-device text recognition: select words on the image and copy them. |
| **Export** | Copy, save, save as PNG/JPEG, or drag straight into another app. Lossless PNG compression. Optional watermark. |
| **Organise** | Presets, a history of past screenshots with their edits, and configurable shortcuts. |
| **Languages** | English and Turkish. [Add yours!](CONTRIBUTING.md#translations) |

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/result.png" alt="Exported screenshot with a gradient background, shadow and annotations"></td>
    <td width="50%"><img src="docs/screenshots/text-select.png" alt="Selecting recognised text on a screenshot"></td>
  </tr>
  <tr>
    <td align="center"><sub>Exported image</sub></td>
    <td align="center"><sub>Select and copy text from any screenshot</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/editor-light.png" alt="Lumela editor in the light theme with a 16:9 layout"></td>
    <td width="50%"><img src="docs/screenshots/settings.png" alt="Lumela settings window"></td>
  </tr>
  <tr>
    <td align="center"><sub>Light theme, 16:9 for social media</sub></td>
    <td align="center"><sub>Settings</sub></td>
  </tr>
</table>

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>2</kbd> | Capture an area (<kbd>Space</kbd> switches to window mode) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>3</kbd> | Capture a window |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd> | Capture the full screen |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Copy / Save / Save as |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> / <kbd>Ctrl</kbd>+<kbd>O</kbd> | Open from the clipboard / a file |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>T</kbd> <kbd>V</kbd> | Arrow, text, redact, shape, select text, select |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Undo / redo |
| <kbd>Delete</kbd>, <kbd>[</kbd> <kbd>]</kbd> | Delete, send backward / bring forward |

Capture shortcuts can be changed in **Settings → Shortcuts**. On macOS use <kbd>Cmd</kbd> where it says <kbd>Ctrl</kbd>.

## Build from source

Requirements: [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system.

```bash
git clone https://github.com/tw4/lumela.git
cd lumela
npm install
npm run tauri dev      # run the app in development mode
npm run tauri build    # build installers into src-tauri/target/release/bundle
```

Tests:

```bash
npm test                         # front-end unit tests (Vitest)
cd src-tauri && cargo test       # Rust tests, including real OCR on your platform
npm run dev & npm run e2e        # headless browser smoke test (needs Chrome)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the app is put together.

## Contributing

Bug reports, ideas, translations and pull requests are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
Found a security issue? See [SECURITY.md](SECURITY.md).

## Privacy

Lumela has no accounts and no telemetry. Screenshots, history and settings stay on your computer. The only network request is the update check against this repository's releases.

## License

Lumela is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License v3.0](LICENSE) or (at your option) any later version.
