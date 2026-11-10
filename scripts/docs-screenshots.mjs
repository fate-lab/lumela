// Regenerates the README screenshots from the real UI (Vite dev server + dev-only mock).
//   npm run dev            (in another terminal)
//   node scripts/docs-screenshots.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.env.APP_URL ?? "http://localhost:1420/";
const out = "docs/screenshots";
const executablePath = process.env.CHROME_PATH
  ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/usr/bin/google-chrome");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath });

async function editor(scheme, beautify) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2, colorScheme: scheme, locale: "en-US" });
  await page.addInitScript((b) => {
    localStorage.setItem("scs.settings.v1", JSON.stringify({ state: { beautify: b, prefs: { language: "en" } }, version: 0 }));
  }, beautify);
  await page.goto(url);
  await page.waitForSelector(".annotation-layer canvas");
  await page.waitForTimeout(400);
  return page;
}

async function annotate(page) {
  const box = await page.locator(".annotation-layer").boundingBox();
  const at = (fx, fy) => ({ x: box.x + fx * box.width, y: box.y + fy * box.height });
  const drag = async (a, b) => {
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  };
  await page.locator("button", { hasText: "Auto redact" }).click();
  await page.waitForSelector(".toast");
  // Rectangle around the Save button, arrow pointing at it.
  await page.keyboard.press("Digit4");
  await drag(at(0.125, 0.565), at(0.275, 0.648));
  await page.keyboard.press("Digit1");
  await drag(at(0.62, 0.80), at(0.29, 0.62));
  await page.keyboard.press("Digit2");
  const t = at(0.62, 0.48);
  await page.mouse.click(t.x, t.y);
  await page.waitForSelector(".text-editor textarea");
  await page.keyboard.type("Ship it!");
  await page.keyboard.press("Enter");
  await page.keyboard.press("KeyV");
  await page.mouse.click(box.x + 5, box.y + 5);
  await page.waitForSelector(".toast", { state: "detached", timeout: 6000 }).catch(() => {});
}

// 1. Editor, dark theme, with annotations and auto-redaction
let page = await editor("dark", { autoBalance: false, padding: 12, radius: 14, shadow: 55, background: { kind: "gradient", from: "#f472b6", to: "#7c3aed", angle: 135 } });
await annotate(page);
await page.screenshot({ path: `${out}/editor-dark.png` });
// 2. The exported image (preview canvas only)
await page.locator(".canvas-wrap").screenshot({ path: `${out}/result.png` });
await page.close();

// 3. Editor, light theme, another background and the 16:9 ratio
page = await editor("light", { autoBalance: false, padding: 10, radius: 18, shadow: 40, ratio: "16:9", background: { kind: "gradient", from: "#43cea2", to: "#185a9d", angle: 135 } });
await page.screenshot({ path: `${out}/editor-light.png` });
await page.close();

// 4. Text selection (OCR)
page = await editor("dark", { autoBalance: false, padding: 10 });
await page.keyboard.press("KeyT");
await page.waitForSelector(".ocr-word");
const b = await page.locator(".annotation-layer").boundingBox();
await page.mouse.move(b.x + b.width * 0.12, b.y + b.height * 0.24); await page.mouse.down();
await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.42, { steps: 8 }); await page.mouse.up();
await page.screenshot({ path: `${out}/text-select.png` });
await page.close();

// 5. Settings
const s = await browser.newPage({ viewport: { width: 820, height: 560 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "en-US" });
await s.goto(url + "?view=settings");
await s.waitForSelector(".brand");
await s.locator("nav button", { hasText: "Text recognition" }).click();
await s.waitForTimeout(300);
await s.screenshot({ path: `${out}/settings.png` });

await browser.close();
console.log(`screenshots written to ${out}/`);
