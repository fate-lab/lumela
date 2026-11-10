import { useStore } from "../lib/store";
import { Dict, en } from "./en";
import { tr } from "./tr";

export type Lang = "en" | "tr";
export type LangPref = "auto" | Lang;

const DICTS: Record<Lang, Dict> = { en, tr };
export const LANGUAGES: [Lang, string][] = [["en", "English"], ["tr", "Türkçe"]];

/** System language if we have it, otherwise English. */
export function detectLang(locales: readonly string[] = typeof navigator !== "undefined" ? navigator.languages : []): Lang {
  for (const l of locales) {
    const base = l.toLowerCase().split("-")[0];
    if (base in DICTS) return base as Lang;
  }
  return "en";
}

export const resolveLang = (pref: LangPref | undefined): Lang => (pref && pref !== "auto" ? pref : detectLang());

/** Strings for the chosen language (re-renders when the preference changes). */
export function useT(): Dict {
  const pref = useStore((s) => s.prefs.language);
  return DICTS[resolveLang(pref)];
}

/** Non-React access (canvas drawing, module-level helpers). */
export function getT(): Dict {
  return DICTS[resolveLang(useStore.getState().prefs.language)];
}
