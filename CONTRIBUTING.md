# Contributing to Lumela

Thanks for helping! Every contribution counts: bug reports, ideas, translations, docs and code.

## Ways to help

- **Report a bug** with the [bug report form](https://github.com/tw4/lumela/issues/new?template=bug_report.yml). Steps to reproduce and your OS version help a lot.
- **Suggest a feature** with the [feature request form](https://github.com/tw4/lumela/issues/new?template=feature_request.yml).
- **Pick an issue** labelled [`good first issue`](https://github.com/tw4/lumela/labels/good%20first%20issue) or [`help wanted`](https://github.com/tw4/lumela/labels/help%20wanted).
- **Translate** the app into your language (see below).

## Development setup

1. Install [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) (stable) and the
   [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.
2. Clone and run:
   ```bash
   git clone https://github.com/tw4/lumela.git
   cd lumela
   npm install
   npm run tauri dev
   ```
3. UI-only work: `npm run dev` opens the editor in a normal browser with a built-in fake
   backend (`src/dev/browserMock.ts`), so you can iterate without the native shell.

Project layout and data flow: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Before you open a pull request

```bash
npx tsc --noEmit                              # types
npm test                                      # Vitest
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
npm run dev   # in one terminal
npm run e2e   # in another (headless Chrome smoke test)
```

CI runs the same checks on Windows, macOS and Linux.

Guidelines:

- Keep pull requests focused: one fix or feature per PR.
- Add or update tests for behaviour changes; pure logic lives in `src/lib/*` and is easy to unit test.
- User-facing text goes through `src/i18n` (never hard-code strings in components).
- Write commit messages in the imperative mood ("Add …", "Fix …").
- By contributing you agree that your work is licensed under the project's
  [GPL-3.0-or-later](LICENSE) licence.

## Translations

1. Copy `src/i18n/en.ts` to `src/i18n/<code>.ts` (for example `de.ts`) and translate the values.
   Keep the keys and the `{date}` / `{time}` placeholders as they are.
2. Register it in `src/i18n/index.ts` (`DICTS` and `LANGUAGES`).
3. `npm test` checks that your file has exactly the same keys as English.

## Releasing (maintainers)

Bump `version` in `src-tauri/tauri.conf.json` and `package.json`, write the release notes in
`.github/release-notes/vX.Y.Z.md` (optional; GitHub generates notes otherwise), then push a tag `vX.Y.Z`.
The release workflow builds, signs and audits installers for all platforms and creates a
draft release; review it and press **Publish**.
