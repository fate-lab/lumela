// Records the README demo (docs/demo.gif) from the real UI (Vite dev server + dev-only mock).
//   npm run dev            (in another terminal)
//   node scripts/docs-demo.mjs        (needs ffmpeg on PATH)
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const url = process.env.APP_URL ?? "http://localhost:1420/";
const out = "docs/demo.gif";
const executablePath = process.env.CHROME_PATH
  ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");
const size = { width: 1280, height: 760 };
const videoDir = mkdtempSync(join(tmpdir(), "lumela-demo-"));

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({
  viewport: size, deviceScaleFactor: 1, colorScheme: "dark", locale: "en-US",
  recordVideo: { dir: videoDir, size },
});
const page = await context.newPage();
// Start from the raw screenshot: no background, padding, corners or shadow.
await page.addInitScript(() => {
  localStorage.setItem("scs.settings.v1", JSON.stringify({
    state: { beautify: { autoBalance: false, padding: 0, radius: 0, shadow: 0, background: { kind: "none" } }, prefs: { language: "en" } },
    version: 0,
  }));
});
const t0 = Date.now();
await page.goto(url);
await page.waitForSelector(".annotation-layer canvas");
await page.waitForTimeout(1200);
const start = (Date.now() - t0) / 1000 - 0.3; // trim the blank page load

const wait = (ms) => page.waitForTimeout(ms);
const slide = async (label, to, step) => {
  const input = page.locator(".panel label.slider", { hasText: label }).locator('input[type="number"]');
  for (let v = 0; v <= to; v += step) { await input.fill(String(Math.min(v, to))); await wait(25); }
};

// 1. Beautify: background, padding, corners and shadow.
await page.locator(".panel .swatch").nth(2).click();
await wait(500);
await slide("Padding", 12, 1);
await slide("Corners", 14, 2);
await slide("Shadow", 55, 5);
await wait(600);
await page.locator(".panel .swatch").nth(3).click();
await wait(700);
await page.locator(".panel .swatch").nth(1).click();
await wait(900);

// 2. Annotate and redact.
const box = await page.locator(".annotation-layer").boundingBox();
const at = (fx, fy) => ({ x: box.x + fx * box.width, y: box.y + fy * box.height });
const drag = async (a, b) => {
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 18 }); await page.mouse.up();
};
await page.locator("button", { hasText: "Auto redact" }).click();
await page.waitForSelector(".toast");
await wait(1300);
await page.keyboard.press("Digit4");
await drag(at(0.125, 0.565), at(0.275, 0.648));
await wait(300);
await page.keyboard.press("Digit1");
await drag(at(0.62, 0.80), at(0.29, 0.62));
await wait(300);
await page.keyboard.press("Digit2");
const t = at(0.62, 0.48);
await page.mouse.click(t.x, t.y);
await page.waitForSelector(".text-editor textarea");
await page.keyboard.type("Ship it!", { delay: 70 });
await page.keyboard.press("Enter");
await page.keyboard.press("KeyV");
await page.mouse.click(box.x + 5, box.y + 5);
await page.waitForSelector(".toast", { state: "detached", timeout: 6000 }).catch(() => {});
await wait(400);

// 3. Copy.
await page.locator("header button.primary").click();
await wait(2200);

const end = (Date.now() - t0) / 1000;
await context.close();
await browser.close();

const video = join(videoDir, readdirSync(videoDir).find((f) => f.endsWith(".webm")));
const filters = "fps=12,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle";
const tmp = join(videoDir, "demo.gif");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(Math.max(0, start)), "-to", String(end), "-i", video, "-vf", filters, "-loop", "0", tmp]);
copyFileSync(tmp, out);
rmSync(videoDir, { recursive: true, force: true });
console.log(`demo written to ${out}`);
