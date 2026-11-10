// Browser smoke test of the editor against the Vite dev server with the dev-only
// Tauri mock (src/dev/browserMock.ts). Usage:
//   npm run dev   (in another terminal)
//   node e2e/editor.smoke.mjs [outDir]
// Env: CHROME_PATH (defaults to the usual Windows install), APP_URL.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "e2e-out";
mkdirSync(out, { recursive: true });
const url = process.env.APP_URL ?? "http://localhost:1420/";
const executablePath = process.env.CHROME_PATH
  ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, locale: "en-US" });
const errors = [];
const logs = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => (m.type() === "error" ? errors.push(m.text()) : logs.push(m.text())));

// Fixed layout: no auto-balance, known padding, so screenshot pixels map predictably.
await page.addInitScript(() => {
  localStorage.setItem("scs.settings.v1", JSON.stringify({
    state: { beautify: { autoBalance: false, autoBackground: false, padding: 10, inset: 0, ratio: "auto" } }, version: 0,
  }));
});
await page.goto(url);
await page.waitForSelector(".annotation-layer canvas", { timeout: 15000 });
await page.waitForTimeout(300);

const box = await page.locator(".annotation-layer").boundingBox();
// Fake screenshot is 1280×800, padding 10% of 800 = 80px on each side → 1440×960 layout.
const LW = 1440, LH = 960, PAD = 80;
const at = (x, y) => ({ x: box.x + ((PAD + x) / LW) * box.width, y: box.y + ((PAD + y) / LH) * box.height });
const drag = async (a, b) => {
  const p = at(...a), q = at(...b);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 4 });
  await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
};
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const count = () => page.evaluate(() => document.querySelectorAll(".annotation-layer canvas").length);

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

// Arrow
await page.keyboard.press("Digit1");
await drag([700, 600], [420, 190]);
// Shape (rectangle around the save button)
await page.keyboard.press("Digit4");
await drag([100, 470], [300, 540]);
// Switching tools must not move the stage: the shape lands where the pointer was.
const shapeY = await page.evaluate(() => window.__scs.annotations.find((a) => a.kind === "shape")?.y);
check("tool switch keeps stage in place", Math.abs(shapeY - 470) < 3, `shape y=${shapeY}`);
// Redact (pixelate the email row)
await page.keyboard.press("Digit3");
await drag([100, 165], [460, 200]);
// Text
await page.keyboard.press("Digit2");
const t = at(800, 360);
await page.mouse.click(t.x, t.y);
await shot("0-before-text");
await page.waitForSelector(".text-editor textarea", { timeout: 5000 }).catch(async (e) => {
  console.log("errors:", errors.join(" | "));
  throw e;
});
await page.keyboard.type("Click here");
await page.keyboard.press("Enter");
await page.waitForSelector(".text-editor", { state: "detached" });
await shot("1-annotated");

const undoEnabled = await page.locator('button[title^="Undo"]').isEnabled();
check("undo enabled after drawing", undoEnabled);

// Select tool, select the arrow by clicking its middle, then change colour to blue
await page.keyboard.press("KeyV");
const mid = at(560, 395);
await page.mouse.click(mid.x, mid.y);
const deleteEnabled = await page.locator('button[title^="Delete"]').isEnabled();
check("click selects arrow", deleteEnabled);
await page.locator('.colors .dot[title="#0a84ff"]').first().click();
await shot("2-arrow-selected-blue");

// Drag the arrow's head handle somewhere else
const head = at(420, 190), newHead = at(560, 120);
await page.mouse.move(head.x, head.y);
await page.mouse.down();
await page.mouse.move(newHead.x, newHead.y, { steps: 6 });
await page.mouse.up();
await shot("3-arrow-redirected");

// Undo the redirect and the recolour
await page.keyboard.press("Control+z");
await page.keyboard.press("Control+z");
await shot("4-after-two-undos");

// Delete the selection, then undo it
await page.keyboard.press("Delete");
await shot("5-deleted");
await page.keyboard.press("Control+z");

// Auto-redact adds one redaction per sensitive hit
await page.locator("button", { hasText: "Auto redact" }).click();
await page.waitForFunction(() => document.querySelector(".toast")?.textContent?.includes("redacted"), null, { timeout: 5000 });
check("auto-redact reports 4 areas", (await page.locator(".toast").textContent()).startsWith("4 "));
await shot("6-auto-redacted");

// Text selection: drag over the server IP line, copy the selected words
await page.keyboard.press("KeyT");
await page.waitForSelector(".ocr-word");
await drag([100, 300], [400, 330]);
const selBtn = page.locator("button", { hasText: "Copy selected" });
check("text drag selects words", /\((\d+)\)/.test(await selBtn.textContent()) && !(await selBtn.textContent()).includes("(0)"));
await shot("7-text-selected");
await selBtn.click();
await page.waitForTimeout(200);
check("selected text copied", logs.some((l) => l.includes("[mock] copy_text") && l.includes("Server IP: 192.168.10.24")));
await page.keyboard.press("Escape");

// Export goes through the mock; check it received pixels
await page.locator("button.primary", { hasText: "Copy" }).click();
await page.waitForTimeout(500);
check("copy invoked mock", logs.some((l) => l.includes("[mock] copy_rgba")));

// Presets: save the current settings, change padding, re-apply
await page.locator("button", { hasText: "Save current settings" }).click();
await page.locator(".preset-name").fill("Blog");
await page.keyboard.press("Enter");
const paddingInput = page.locator(".slider", { has: page.locator("span", { hasText: /^Padding$/ }) }).locator('input[type="number"]');
await paddingInput.fill("40");
await page.locator(".preset button", { hasText: "Blog" }).click();
check("preset restores padding", (await paddingInput.inputValue()) === "10");

// History: open the drawer, reopen an entry, its saved annotations come back
await page.locator("button", { hasText: "History" }).first().click();
await page.waitForSelector(".history-item img");
await shot("8-history");
await page.locator(".history-item").first().click();
await page.waitForFunction(() => window.__scs.annotations.some((a) => a.id === "h1"), null, { timeout: 5000 });
check("history restores annotations", true);

check("no page errors", errors.length === 0, errors.join(" | "));

// Watermark: turning it on in the store changes the exported pixels near the bottom-right
const bottomRight = () => page.evaluate(() => {
  const c = document.querySelector(".preview");
  const d = c.getContext("2d").getImageData(Math.round(c.width * 0.75), Math.round(c.height * 0.93), Math.round(c.width * 0.2), Math.round(c.height * 0.05)).data;
  let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
  return sum;
});
const enableCustomWatermark = () => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("scs.settings.v1"));
  raw.state.prefs = { ...raw.state.prefs, watermark: { enabled: true, text: "@lumela", position: "bottom-right", templates: [] } };
  localStorage.setItem("scs.settings.v1", JSON.stringify(raw));
  window.dispatchEvent(new StorageEvent("storage", { key: "scs.settings.v1" }));
});
// No forced watermark; a custom one appears only when the user turns it on.
const plain = await bottomRight();
await enableCustomWatermark();
await page.waitForTimeout(400);
check("custom watermark is drawn when enabled", (await bottomRight()) !== plain);
await shot("10-watermark");

// Settings window renders every tab
const sp = await browser.newPage({ viewport: { width: 800, height: 640 }, locale: "en-US" });
sp.on("pageerror", (e) => errors.push(String(e)));
await sp.goto(url + "?view=settings");
for (const tab of ["General", "Shortcuts", "Export", "Watermark", "Text recognition"]) {
  await sp.locator("nav button", { hasText: tab }).click();
  await sp.waitForSelector(".settings-body > *");
  await sp.screenshot({ path: join(out, `9-settings-${tab}.png`) });
}
check("settings tabs render without errors", errors.length === 0, errors.join(" | "));

await browser.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
