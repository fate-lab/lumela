// Picks the files to publish from the CI build artifacts and writes latest.json for
// the in-app updater. Only installers and their updater signatures are published.
//
//   node scripts/latest-json.mjs <artifacts dir> <version tag> <out dir>
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const REPO = "tw4/lumela";

/** Which built file feeds which updater platform, and which extra files are published as plain downloads. */
export const PATTERNS = {
  updater: [
    { platforms: ["windows-x86_64"], re: /-setup\.exe$/ },
    { platforms: ["darwin-aarch64", "darwin-x86_64"], re: /\.app\.tar\.gz$/ },
    { platforms: ["linux-x86_64"], re: /\.AppImage$/ },
  ],
  downloads: [/\.msi$/, /\.dmg$/, /\.deb$/],
};

export function* walk(p) {
  if (statSync(p).isDirectory()) for (const e of readdirSync(p)) yield* walk(join(p, e));
  else yield p;
}

/**
 * @param files all artifact paths
 * @param readSig reads a .sig file's content
 * @returns { publish: string[], latest: object }
 */
export function plan(files, version, readSig, now = new Date()) {
  const publish = [];
  const platforms = {};
  for (const { platforms: keys, re } of PATTERNS.updater) {
    const file = files.find((f) => re.test(f));
    if (!file) throw new Error(`missing updater artifact for ${keys.join(", ")} (${re})`);
    const sig = files.find((f) => f === `${file}.sig`);
    if (!sig) throw new Error(`missing signature for ${basename(file)}`);
    publish.push(file, sig);
    const url = `https://github.com/${REPO}/releases/download/${version}/${encodeURIComponent(basename(file))}`;
    for (const k of keys) platforms[k] = { signature: readSig(sig).trim(), url };
  }
  for (const re of PATTERNS.downloads) {
    const file = files.find((f) => re.test(f));
    if (file && !publish.includes(file)) publish.push(file);
  }
  const names = publish.map((f) => basename(f));
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new Error(`duplicate file name: ${dup}`);
  return {
    publish,
    latest: { version: version.replace(/^v/, ""), notes: `Lumela ${version}`, pub_date: now.toISOString(), platforms },
  };
}

if (process.argv[1]?.endsWith("latest-json.mjs")) {
  const [dir, version, out] = process.argv.slice(2);
  if (!dir || !version || !out) {
    console.error("usage: node scripts/latest-json.mjs <artifacts dir> <version tag> <out dir>");
    process.exit(2);
  }
  const { publish, latest } = plan([...walk(dir)], version, (p) => readFileSync(p, "utf8"));
  mkdirSync(out, { recursive: true });
  for (const f of publish) copyFileSync(f, join(out, basename(f)));
  writeFileSync(join(out, "latest.json"), JSON.stringify(latest, null, 2));
  console.log([...publish.map((f) => basename(f)), "latest.json"].join("\n"));
}
