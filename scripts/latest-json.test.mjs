import { describe, expect, it } from "vitest";
import { plan } from "./latest-json.mjs";

const files = [
  "a/windows/nsis/Lumela_0.2.0_x64-setup.exe",
  "a/windows/nsis/Lumela_0.2.0_x64-setup.exe.sig",
  "a/windows/msi/Lumela_0.2.0_x64_en-US.msi",
  "a/windows/msi/Lumela_0.2.0_x64_en-US.msi.sig",
  "a/macos/macos/Lumela.app.tar.gz",
  "a/macos/macos/Lumela.app.tar.gz.sig",
  "a/macos/dmg/Lumela_0.2.0_universal.dmg",
  "a/linux/appimage/Lumela_0.2.0_amd64.AppImage",
  "a/linux/appimage/Lumela_0.2.0_amd64.AppImage.sig",
  "a/linux/deb/Lumela_0.2.0_amd64.deb",
  "a/linux/rpm/Lumela-0.2.0-1.x86_64.rpm",
  "a/windows/lumela.exe",
  "a/windows/lumela.pdb",
];

describe("release plan", () => {
  const p = plan(files, "v0.2.0", (s) => `sig-of-${s}\n`, new Date("2026-11-10T10:00:00Z"));

  it("publishes only installers and updater signatures", () => {
    const names = p.publish.map((f) => f.split("/").pop());
    expect(names).toEqual([
      "Lumela_0.2.0_x64-setup.exe", "Lumela_0.2.0_x64-setup.exe.sig",
      "Lumela.app.tar.gz", "Lumela.app.tar.gz.sig",
      "Lumela_0.2.0_amd64.AppImage", "Lumela_0.2.0_amd64.AppImage.sig",
      "Lumela_0.2.0_x64_en-US.msi", "Lumela_0.2.0_universal.dmg", "Lumela_0.2.0_amd64.deb",
    ]);
    expect(names).not.toContain("lumela.pdb");
    expect(names).not.toContain("lumela.exe");
  });

  it("writes latest.json for every platform", () => {
    expect(p.latest.version).toBe("0.2.0");
    expect(Object.keys(p.latest.platforms).sort()).toEqual(["darwin-aarch64", "darwin-x86_64", "linux-x86_64", "windows-x86_64"]);
    expect(p.latest.platforms["windows-x86_64"]).toEqual({
      signature: "sig-of-a/windows/nsis/Lumela_0.2.0_x64-setup.exe.sig",
      url: "https://github.com/tw4/lumela/releases/download/v0.2.0/Lumela_0.2.0_x64-setup.exe",
    });
    expect(p.latest.notes).toBe("Lumela v0.2.0");
  });

  it("refuses to publish an unsigned updater artifact", () => {
    expect(() => plan(files.filter((f) => !f.endsWith("AppImage.sig")), "v0.2.0", () => "")).toThrow(/signature/);
  });
});
