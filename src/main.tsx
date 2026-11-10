import React from "react";
import ReactDOM from "react-dom/client";
import Editor from "./editor/Editor";
import { resolveLang } from "./i18n";
import { useStore } from "./lib/store";
import Overlay from "./overlay/Overlay";
import Settings from "./settings/Settings";
import "./styles.css";

const view = new URLSearchParams(window.location.search).get("view");
document.documentElement.dataset.view = view ?? "editor";

// Keep <html lang> in sync with the UI language (affects text-transform, hyphenation, a11y).
const syncLang = () => { document.documentElement.lang = resolveLang(useStore.getState().prefs.language); };
syncLang();
useStore.subscribe(syncLang);

async function start() {
  // In a plain browser during development, fake the Tauri backend.
  if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
    (await import("./dev/browserMock")).installBrowserMock();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>{view === "overlay" ? <Overlay /> : view === "settings" ? <Settings /> : <Editor />}</React.StrictMode>,
  );
}
start();
