// Points the Homebrew cask and Scoop manifest at a release.
//   node scripts/update-packages.mjs <version> <dmg sha256> <windows setup sha256>
import { readFileSync, writeFileSync } from "node:fs";

const [version, dmgSha, exeSha] = process.argv.slice(2);
const hex = /^[0-9a-f]{64}$/i;
if (!/^\d+\.\d+\.\d+$/.test(version ?? "") || !hex.test(dmgSha ?? "") || !hex.test(exeSha ?? "")) {
  console.error("usage: update-packages.mjs <version> <dmg sha256> <windows setup sha256>");
  process.exit(1);
}

const cask = "packaging/homebrew/lumela.rb";
const rb = readFileSync(cask, "utf8")
  .replace(/^(\s*version )"[^"]*"/m, `$1"${version}"`)
  .replace(/^(\s*sha256 )"[^"]*"/m, `$1"${dmgSha.toLowerCase()}"`);
writeFileSync(cask, rb);

const scoop = "packaging/scoop/lumela.json";
const json = readFileSync(scoop, "utf8")
  .replace(/("version": )"[^"]*"/, `$1"${version}"`)
  .replace(/("url": )"[^"$]*\/v[^"$]*"/, `$1"https://github.com/tw4/lumela/releases/download/v${version}/Lumela_${version}_x64-setup.exe"`)
  .replace(/("hash": )"[^"]*"/, `$1"${exeSha.toLowerCase()}"`);
JSON.parse(json);
writeFileSync(scoop, json);

console.log(`packages point at v${version}`);
