import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArrowStyle, RedactMode, ShapeKind } from "./annotations";
import { BeautifySettings, DEFAULT_SETTINGS } from "./beautify";
import type { ExportFormat, RedactCategories } from "./ipc";

export interface AppPrefs {
  saveDir: string; // empty = Pictures/Lumela
  fileNameTemplate: string;
  closeAfterCopy: boolean;
  format: ExportFormat;
  /** OCR language tag; empty = system languages. */
  ocrLanguage: string;
  autoRedact: RedactCategories;
  /** Run auto-redact as soon as an image is loaded. */
  autoRedactOnLoad: boolean;
  /** Shutter sound when a capture lands in the editor. */
  sounds: boolean;
  /** Lossless PNG optimisation on Save / Save As / drag (hold Alt to skip). */
  compressPng: boolean;
  watermark: WatermarkPrefs;
  /** UI language; "auto" follows the system. */
  language: "auto" | "en" | "tr";
}

export type WatermarkPosition = "bottom-right" | "bottom-center" | "bottom-left";
export interface WatermarkPrefs { enabled: boolean; text: string; position: WatermarkPosition; templates: string[] }

export const DEFAULT_PREFS: AppPrefs = {
  saveDir: "",
  fileNameTemplate: "Lumela {date} at {time}",
  closeAfterCopy: false,
  format: "png",
  ocrLanguage: "",
  autoRedact: { emails: true, creditCards: true, ipAddresses: true, apiKeys: true, customWords: [] },
  autoRedactOnLoad: false,
  sounds: true,
  compressPng: true,
  watermark: { enabled: false, text: "@username", position: "bottom-right", templates: ["@username", "example.com", "{date}"] },
  language: "auto",
};

/** Defaults for new annotations. Widths and sizes are at the 1000px reference (see beautify.unit). */
export interface ToolStyle {
  arrowColor: string;
  arrowWidth: number;
  arrowStyle: ArrowStyle;
  textColor: string;
  textSize: number;
  shapeColor: string;
  shapeWidth: number;
  shapeKind: ShapeKind;
  shapeFilled: boolean;
  redactMode: RedactMode;
  redactColor: string;
}

export const DEFAULT_TOOL_STYLE: ToolStyle = {
  arrowColor: "#ff3b30",
  arrowWidth: 5,
  arrowStyle: "straight",
  textColor: "#ff3b30",
  textSize: 28,
  shapeColor: "#ff3b30",
  shapeWidth: 4,
  shapeKind: "rect",
  shapeFilled: false,
  redactMode: "pixelate",
  redactColor: "#111111",
};

export const PALETTE = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a84ff", "#af52de", "#ffffff", "#111111"];

export interface Preset { id: string; name: string; beautify: BeautifySettings }

interface Store {
  beautify: BeautifySettings;
  prefs: AppPrefs;
  tools: ToolStyle;
  presets: Preset[];
  /** Preset the current settings came from; cleared when settings are edited by hand. */
  activePresetId: string | null;
  lastPresetId: string | null;
  setBeautify: (p: Partial<BeautifySettings>) => void;
  setPrefs: (p: Partial<AppPrefs>) => void;
  setTools: (p: Partial<ToolStyle>) => void;
  savePreset: (name: string) => string;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  reset: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      beautify: DEFAULT_SETTINGS,
      prefs: DEFAULT_PREFS,
      tools: DEFAULT_TOOL_STYLE,
      presets: [],
      activePresetId: null,
      lastPresetId: null,
      setBeautify: (p) => set((s) => ({ beautify: { ...s.beautify, ...p }, activePresetId: null })),
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      setTools: (p) => set((s) => ({ tools: { ...s.tools, ...p } })),
      savePreset: (name) => {
        const id = Math.random().toString(36).slice(2, 10);
        set((s) => {
          // Saving under an existing name overwrites that preset.
          const rest = s.presets.filter((p) => p.name !== name);
          return { presets: [...rest, { id, name, beautify: s.beautify }], activePresetId: id, lastPresetId: id };
        });
        return id;
      },
      applyPreset: (id) =>
        set((s) => {
          const p = s.presets.find((x) => x.id === id);
          return p ? { beautify: { ...DEFAULT_SETTINGS, ...p.beautify }, activePresetId: id, lastPresetId: id } : {};
        }),
      deletePreset: (id) =>
        set((s) => ({
          presets: s.presets.filter((p) => p.id !== id),
          activePresetId: s.activePresetId === id ? null : s.activePresetId,
          lastPresetId: s.lastPresetId === id ? null : s.lastPresetId,
        })),
      reset: () => set({ beautify: DEFAULT_SETTINGS, activePresetId: null }),
    }),
    {
      name: "scs.settings.v1",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return {
          ...current,
          beautify: { ...current.beautify, ...p.beautify },
          prefs: {
            ...current.prefs,
            ...p.prefs,
            autoRedact: { ...current.prefs.autoRedact, ...p.prefs?.autoRedact },
            watermark: { ...current.prefs.watermark, ...p.prefs?.watermark },
          },
          tools: { ...current.tools, ...p.tools },
        };
      },
    },
  ),
);

// Editor and settings windows share localStorage; pick up changes made in the other window.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "scs.settings.v1") useStore.persist.rehydrate();
  });
}
