import { open } from "@tauri-apps/plugin-dialog";
import { Background, BeautifySettings, GRADIENTS, RATIOS } from "../lib/beautify";
import { wallpaperPath } from "../lib/ipc";
import { useStore } from "../lib/store";
import { Slider, Toggle } from "../ui/controls";
import PresetBar from "./PresetBar";
import { getT, useT } from "../i18n";

const IMAGE_FILTERS = () => [{ name: getT().common.imageFiles, extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }];

function css(bg: Background): string {
  if (bg.kind === "gradient") return `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
  if (bg.kind === "solid") return bg.color;
  return "";
}

function same(a: Background, b: Background) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Panel({ edgeBackground, onError }: { edgeBackground: Background | null; onError: (m: string) => void }) {
  const { beautify: s, setBeautify, reset } = useStore();
  const t = useT();
  const set = (p: Partial<BeautifySettings>) => setBeautify(p);
  const bg = s.background;

  const pickBg = (b: Background) => set({ background: b, autoBackground: false });
  const custom = bg.kind === "gradient" ? bg : { kind: "gradient" as const, from: "#4facfe", to: "#8e54e9", angle: 135 };
  const imageBg = !s.autoBackground && bg.kind === "image" ? bg : null;
  const keep = imageBg ? { brightness: imageBg.brightness, blur: imageBg.blur } : { brightness: 100, blur: 0 };

  const pickImage = async () => {
    const p = await open({ multiple: false, filters: IMAGE_FILTERS() });
    if (typeof p === "string") pickBg({ kind: "image", path: p, wallpaper: false, ...keep });
  };
  const pickWallpaper = async () => {
    try {
      pickBg({ kind: "image", path: await wallpaperPath(), wallpaper: true, ...keep });
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <aside className="panel">
      <PresetBar />

      <section>
        <h2>{t.panel.background}</h2>
        <div className="swatches">
          <button
            className={`swatch auto${s.autoBackground ? " active" : ""}`}
            style={{ background: edgeBackground ? css(edgeBackground) : undefined }}
            onClick={() => set({ autoBackground: true })}
            title={t.panel.autoBackground}
          >A</button>
          {GRADIENTS.map((g) => {
            const b: Background = { kind: "gradient", from: g.from, to: g.to, angle: g.angle };
            return (
              <button
                key={g.id} title={g.name}
                className={`swatch${!s.autoBackground && same(b, bg) ? " active" : ""}`}
                style={{ background: css(b) }}
                onClick={() => pickBg(b)}
              />
            );
          })}
          <button
            className={`swatch none${!s.autoBackground && bg.kind === "none" ? " active" : ""}`}
            title={t.panel.transparent} onClick={() => pickBg({ kind: "none" })}
          />
        </div>
        <div className="row">
          <label className="color" title={t.panel.solidColor}>
            <input
              type="color" value={bg.kind === "solid" ? bg.color : "#ffffff"}
              onChange={(e) => pickBg({ kind: "solid", color: e.target.value })}
            />
            <span>{t.panel.solid}</span>
          </label>
          <label className="color" title={t.panel.gradientStart}>
            <input type="color" value={custom.from} onChange={(e) => pickBg({ ...custom, from: e.target.value })} />
          </label>
          <label className="color" title={t.panel.gradientEnd}>
            <input type="color" value={custom.to} onChange={(e) => pickBg({ ...custom, to: e.target.value })} />
            <span>{t.panel.gradient}</span>
          </label>
        </div>
        {bg.kind === "gradient" && !s.autoBackground && (
          <Slider label={t.panel.angle} value={bg.angle} min={0} max={360} onChange={(angle) => pickBg({ ...bg, angle })} />
        )}
        <div className="row">
          <button className={imageBg && !imageBg.wallpaper ? "active" : ""} onClick={pickImage}>{t.panel.image}</button>
          <button className={imageBg?.wallpaper ? "active" : ""} onClick={pickWallpaper}>{t.panel.wallpaper}</button>
        </div>
        {imageBg && (
          <>
            <code className="path" title={imageBg.path}>{imageBg.path}</code>
            <Slider label={t.panel.brightness} value={imageBg.brightness} min={0} max={200} onChange={(brightness) => pickBg({ ...imageBg, brightness })} />
            <Slider label={t.panel.blur} value={imageBg.blur} min={0} max={40} onChange={(blur) => pickBg({ ...imageBg, blur })} />
          </>
        )}
      </section>

      <section>
        <h2>{t.panel.frame}</h2>
        <Toggle
          label={t.panel.autoBalance} checked={s.autoBalance} onChange={(autoBalance) => set({ autoBalance })}
          hint={t.panel.autoBalanceHint}
        />
        <Slider label={t.panel.padding} value={s.padding} min={0} max={100} onChange={(padding) => set({ padding })} />
        <Slider label={t.panel.inset} value={s.inset} min={0} max={100} onChange={(inset) => set({ inset })} />
        <Slider label={t.panel.radius} value={s.radius} min={0} max={60} onChange={(radius) => set({ radius })} />
        <Slider label={t.panel.shadow} value={s.shadow} min={0} max={100} onChange={(shadow) => set({ shadow })} />
      </section>

      <section>
        <h2>{t.panel.ratio}</h2>
        <div className="ratios">
          {RATIOS.map((r) => (
            <button
              key={r.id} className={s.ratio === r.id ? "active" : ""} onClick={() => set({ ratio: r.id })}
              title={r.id === "auto" ? t.ratios.autoHint : r.id === "1:1" ? t.ratios.square : r.id === "9:16" ? t.ratios.portrait : r.hint}
            >
              {r.id === "auto" ? t.ratios.auto : r.label}
            </button>
          ))}
        </div>
      </section>

      <button className="reset" onClick={reset}>{t.panel.resetAll}</button>
    </aside>
  );
}
