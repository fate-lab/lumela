// Release leak check. Scans the files that get published (frontend bundle and, when
// given, the built installers / binaries) for things that must never ship:
// dev-only code, test hooks, source maps, private keys and local machine paths.
//
//   node scripts/audit-release.mjs dist [more files or folders...]
//
// Exits 1 and lists every hit when something is found.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RULES = [
  { name: "dev browser mock", re: /installBrowserMock|browserMock|mockIPC/ },
  { name: "test hook", re: /__scs\b/ },
  { name: "source map reference", re: /sourceMappingURL=/ },
  { name: "private key material", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----|untrusted comment: (rsign|minisign) encrypted secret key/ },
  { name: "updater signing key", re: /TAURI_SIGNING_PRIVATE_KEY=/ },
  { name: "local user path (Windows)", re: /[A-Za-z]:[\\/]{1,2}Users[\\/]{1,2}(?!runneradmin|Default|Public)[A-Za-z0-9._-]+/ },
  { name: "local user path (Unix)", re: /\/(home|Users)\/(?!runner\b)[a-z][a-z0-9._-]{2,}\// },
  { name: "Lemon Squeezy API key", re: /eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9\.[A-Za-z0-9_-]{100,}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
];

const SKIP_EXT = /\.(png|jpe?g|gif|ico|icns|woff2?|ttf)$/i;

// Third-party system libraries bundled into the AppImage (GTK, GnuTLS, libssh, WebKit…)
// contain PEM headers and their builders' paths as constants; they are not our code.
const THIRD_PARTY = /[\\/]usr[\\/]lib[\\/]/;
// Compressed installers/archives: their bytes are not searchable, and the Lumela binary
// inside each of them is audited on its own.
const CONTAINER = /\.(AppImage|dmg|deb|rpm|msi|zip|tar\.gz)$|-setup\.exe$/i;

function* walk(p) {
  const s = statSync(p);
  if (s.isDirectory()) for (const e of readdirSync(p)) yield* walk(join(p, e));
  else yield p;
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node scripts/audit-release.mjs <dir|file>...");
  process.exit(2);
}

const hits = [];
let scanned = 0;
for (const t of targets) {
  for (const file of walk(t)) {
    if (SKIP_EXT.test(file) || THIRD_PARTY.test(file) || CONTAINER.test(file)) continue;
    if (file.endsWith(".map")) { hits.push(`${file}: source map file`); continue; }
    // latin1 keeps every byte, so binaries can be searched as text.
    const text = readFileSync(file).toString("latin1");
    scanned++;
    for (const r of RULES) {
      const m = text.match(r.re);
      if (m) hits.push(`${file}: ${r.name} → ${JSON.stringify(m[0].slice(0, 80))}`);
    }
  }
}

if (hits.length) {
  console.error(`Release audit FAILED (${hits.length} finding(s) in ${scanned} files):`);
  for (const h of hits) console.error("  " + h);
  process.exit(1);
}
console.log(`Release audit passed (${scanned} files).`);
