import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, Update } from "@tauri-apps/plugin-updater";
import { selfUpdateSupported } from "./ipc";

export type UpdateState =
  | { kind: "none" }
  | { kind: "available"; update: Update }
  | { kind: "error"; message: string };

/** Where people download a version by hand (e.g. a `.deb` install on Linux). */
export const RELEASES_URL = "https://github.com/tw4/lumela/releases/latest";

/** The app usually lives in the tray for days, so look again every few hours. */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function checkForUpdate(): Promise<UpdateState> {
  try {
    const update = await check();
    return update ? { kind: "available", update } : { kind: "none" };
  } catch (e) {
    return { kind: "error", message: String(e) };
  }
}

/** Whether this install can replace itself (false for `.deb`/`.rpm` on Linux). */
export async function canSelfUpdate(): Promise<boolean> {
  try {
    return await selfUpdateSupported();
  } catch {
    return true;
  }
}

/**
 * Downloads, installs and restarts. Installs that cannot replace themselves open the
 * release page instead. `onProgress` gets 0–1 when the size is known.
 */
export async function installUpdate(update: Update, onProgress?: (p: number) => void) {
  if (!(await canSelfUpdate())) {
    await openUrl(RELEASES_URL);
    return;
  }
  let total = 0, done = 0;
  await update.downloadAndInstall((e) => {
    if (e.event === "Started") total = e.data.contentLength ?? 0;
    if (e.event === "Progress") { done += e.data.chunkLength; if (total) onProgress?.(done / total); }
  });
  await relaunch();
}

/** Tells about each new version once, however often the check runs. */
export function oncePerVersion() {
  let last: string | null = null;
  return (version: string) => {
    if (version === last) return false;
    last = version;
    return true;
  };
}
