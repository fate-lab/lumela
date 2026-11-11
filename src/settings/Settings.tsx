import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import ShortcutSettings from "../editor/ShortcutSettings";
import { LANGUAGES, useT } from "../i18n";
import {
  AppSettings, defaultSaveDir, getAppSettings, OcrLanguage, ocrLanguages, RedactCategories, setAppSettings,
} from "../lib/ipc";
import { AppPrefs, useStore } from "../lib/store";
import { checkForUpdate, installUpdate } from "../lib/updates";
import { Toggle } from "../ui/controls";

type Tab = "general" | "shortcuts" | "export" | "watermark" | "ocr";
const TAB_IDS: Tab[] = ["general", "shortcuts", "export", "watermark", "ocr"];
const isTab = (t: string | null): t is Tab => TAB_IDS.includes(t as Tab);

function General() {
  const t = useT();
  const { prefs, setPrefs } = useStore();
  const [app, setApp] = useState<AppSettings | null>(null);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAppSettings().then(setApp).catch((e) => setError(String(e)));
    autostartEnabled().then(setAutostart).catch(() => setAutostart(null));
  }, []);
  const update = (p: Partial<AppSettings>) => {
    if (!app) return;
    const next = { ...app, ...p };
    setApp(next);
    setAppSettings(next).catch((e) => setError(String(e)));
  };
  const toggleAutostart = async (on: boolean) => {
    try {
      await (on ? enableAutostart() : disableAutostart());
      setAutostart(await autostartEnabled());
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <>
      <label className="field">
        <span>{t.settings.language}</span>
        <select value={prefs.language} onChange={(e) => setPrefs({ language: e.target.value as AppPrefs["language"] })}>
          <option value="auto">{t.settings.languageAuto}</option>
          {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
      </label>
      {autostart !== null && <Toggle label={t.settings.launchAtLogin} checked={autostart} onChange={toggleAutostart} />}
      {app && (
        <>
          <Toggle label={t.settings.hideAtLaunch} checked={app.hideAtLaunch} onChange={(hideAtLaunch) => update({ hideAtLaunch })} />
          <Toggle
            label={t.settings.hideWhileCapturing} checked={app.hideEditorWhileCapturing}
            onChange={(hideEditorWhileCapturing) => update({ hideEditorWhileCapturing })}
          />
          <Toggle label={t.settings.keepHistory} checked={app.keepHistory} onChange={(keepHistory) => update({ keepHistory })} />
        </>
      )}
      <Toggle label={t.settings.sound} checked={prefs.sounds} onChange={(sounds) => setPrefs({ sounds })} />
      {error && <p className="error">{error}</p>}
      <Updates />
    </>
  );
}

function Export() {
  const t = useT();
  const { prefs, setPrefs } = useStore();
  const [defaultDir, setDefaultDir] = useState("");
  useEffect(() => { defaultSaveDir().then(setDefaultDir).catch(() => {}); }, []);
  return (
    <>
      <label className="field">
        <span>{t.settings.format}</span>
        <select value={prefs.format} onChange={(e) => setPrefs({ format: e.target.value as "png" | "jpeg" })}>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </select>
      </label>
      <label className="field">
        <span>{t.settings.fileName}</span>
        <input value={prefs.fileNameTemplate} onChange={(e) => setPrefs({ fileNameTemplate: e.target.value })} />
      </label>
      <div className="field">
        <span>{t.settings.saveFolder}</span>
        <div className="row">
          <code className="path" title={prefs.saveDir || defaultDir}>{prefs.saveDir || defaultDir}</code>
          <button onClick={async () => { const d = await open({ directory: true }); if (typeof d === "string") setPrefs({ saveDir: d }); }}>{t.common.change}</button>
          {prefs.saveDir && <button onClick={() => setPrefs({ saveDir: "" })}>{t.common.reset}</button>}
        </div>
      </div>
      <Toggle label={t.settings.hideAfterCopy} checked={prefs.closeAfterCopy} onChange={(closeAfterCopy) => setPrefs({ closeAfterCopy })} />
      <Toggle
        label={t.settings.compress} checked={prefs.compressPng} onChange={(compressPng) => setPrefs({ compressPng })}
        hint={t.settings.compressHint}
      />
      <p className="dim">{t.settings.compressAlt}</p>
    </>
  );
}

function WatermarkTab() {
  const t = useT();
  const { prefs, setPrefs } = useStore();
  const wm = prefs.watermark;
  const set = (p: Partial<typeof wm>) => setPrefs({ watermark: { ...wm, ...p } });
  return (
    <>
      <Toggle label={t.settings.watermarkOn} checked={wm.enabled} onChange={(enabled) => set({ enabled })} />
      <label className="field">
        <span>{t.settings.watermarkText}</span>
        <input value={wm.text} onChange={(e) => set({ text: e.target.value })} />
      </label>
      <label className="field">
        <span>{t.settings.position}</span>
        <select value={wm.position} onChange={(e) => set({ position: e.target.value as typeof wm.position })}>
          {(["bottom-right", "bottom-center", "bottom-left"] as const).map((p) => (
            <option key={p} value={p}>{t.settings.positions[p]}</option>
          ))}
        </select>
      </label>
      <h3>{t.settings.templates}</h3>
      <div className="presets">
        {wm.templates.map((tpl) => (
          <span key={tpl} className={`preset${tpl === wm.text ? " active" : ""}`}>
            <button onClick={() => set({ text: tpl })} title={t.settings.useTemplate}>{tpl}</button>
            <button className="x" onClick={() => set({ templates: wm.templates.filter((x) => x !== tpl) })} aria-label={`${t.panel.remove} ${tpl}`}>×</button>
          </span>
        ))}
      </div>
      <button
        disabled={!wm.text.trim() || wm.templates.includes(wm.text)}
        onClick={() => set({ templates: [...wm.templates, wm.text] })}
      >{t.settings.saveTemplate}</button>
    </>
  );
}

function Updates() {
  const t = useT();
  const [state, setState] = useState<"idle" | "checking" | "none" | "error" | "available" | "installing">("idle");
  const [info, setInfo] = useState("");
  const [update, setUpdate] = useState<import("@tauri-apps/plugin-updater").Update | null>(null);
  const checkNow = async () => {
    setState("checking");
    const s = await checkForUpdate();
    if (s.kind === "available") { setUpdate(s.update); setInfo(s.update.version); setState("available"); }
    else if (s.kind === "error") { setInfo(s.message); setState("error"); }
    else setState("none");
  };
  return (
    <>
      <h3>{t.settings.updates}</h3>
      <div className="row">
        <button onClick={checkNow} disabled={state === "checking" || state === "installing"}>{t.settings.checkUpdates}</button>
        {state === "checking" && <span className="dim">{t.settings.checking}</span>}
        {state === "none" && <span className="dim">{t.settings.upToDate}</span>}
        {state === "error" && <span className="error" title={info}>{t.settings.checkFailed}</span>}
        {state === "available" && update && (
          <button className="primary" onClick={() => { setState("installing"); installUpdate(update).then(() => setState("available"), (e) => { setInfo(String(e)); setState("error"); }); }}>
            {t.settings.install(info)}
          </button>
        )}
        {state === "installing" && <span className="dim">{t.settings.downloading}</span>}
      </div>
    </>
  );
}

const CATEGORIES: Exclude<keyof RedactCategories, "customWords">[] = ["emails", "creditCards", "ipAddresses", "apiKeys"];

function Ocr() {
  const t = useT();
  const { prefs, setPrefs } = useStore();
  const [langs, setLangs] = useState<OcrLanguage[] | null>(null);
  useEffect(() => { ocrLanguages().then(setLangs).catch(() => setLangs([])); }, []);
  return (
    <>
      <label className="field">
        <span>{t.settings.ocrLanguage}</span>
        <select value={prefs.ocrLanguage} onChange={(e) => setPrefs({ ocrLanguage: e.target.value })}>
          <option value="">{t.settings.ocrSystem}</option>
          {langs?.map((l) => <option key={l.tag} value={l.tag}>{l.name}</option>)}
        </select>
      </label>
      <h3>{t.settings.autoRedact}</h3>
      {CATEGORIES.map((k) => (
        <Toggle key={k} label={t.settings.categories[k]} checked={prefs.autoRedact[k]} onChange={(v) => setPrefs({ autoRedact: { ...prefs.autoRedact, [k]: v } })} />
      ))}
      <label className="field">
        <span>{t.settings.customWords}</span>
        <textarea
          rows={4}
          spellCheck={false}
          value={prefs.autoRedact.customWords.join("\n")}
          onChange={(e) => setPrefs({ autoRedact: { ...prefs.autoRedact, customWords: e.target.value.split("\n") } })}
        />
      </label>
      <p className="dim">{t.settings.customWordsHint}</p>
      <Toggle
        label={t.settings.redactOnLoad} checked={prefs.autoRedactOnLoad}
        onChange={(autoRedactOnLoad) => setPrefs({ autoRedactOnLoad })}
      />
      <p className="dim">{t.settings.ocrPrivacy}</p>
    </>
  );
}

export default function Settings() {
  const t = useT();
  const initial = new URLSearchParams(location.search).get("tab");
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "general");
  useEffect(() => {
    const un = listen<string>("settings-tab", (e) => isTab(e.payload) && setTab(e.payload));
    return () => { un.then((f) => f()); };
  }, []);
  return (
    <div className="settings">
      <nav>
        <div className="brand"><img src="/lumela.svg" alt="" width={28} height={28} /><span>Lumela</span></div>
        {TAB_IDS.map((id) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{t.settings.tabs[id]}</button>
        ))}
      </nav>
      <main>
        <h1>{t.settings.tabs[tab]}</h1>
        <div className="settings-body">
          {tab === "general" && <General />}
          {tab === "shortcuts" && <ShortcutSettings />}
          {tab === "export" && <Export />}
          {tab === "watermark" && <WatermarkTab />}
          {tab === "ocr" && <Ocr />}
        </div>
      </main>
    </div>
  );
}
