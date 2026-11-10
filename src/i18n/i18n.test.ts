import { describe, expect, it } from "vitest";
import { en } from "./en";
import { detectLang } from "./index";
import { tr } from "./tr";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  it("Turkish has exactly the English keys", () => {
    expect(keys(tr).sort()).toEqual(keys(en).sort());
  });

  it("no string is left empty", () => {
    for (const d of [en, tr]) {
      for (const k of keys(d)) {
        const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], d);
        if (typeof v === "string") expect(v.trim(), k).not.toBe("");
      }
    }
  });

  it("detects the system language and falls back to English", () => {
    expect(detectLang(["tr-TR", "en-US"])).toBe("tr");
    expect(detectLang(["de-DE", "en-GB"])).toBe("en");
    expect(detectLang(["fr-FR"])).toBe("en");
    expect(detectLang([])).toBe("en");
  });

  it("interpolates", () => {
    expect(en.toast.redacted(3)).toBe("3 sensitive area(s) redacted");
    expect(tr.toast.saved("a.png")).toBe("Kaydedildi: a.png");
  });
});
