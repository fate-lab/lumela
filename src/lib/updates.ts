import { relaunch } from "@tauri-apps/plugin-process";
import { check, Update } from "@tauri-apps/plugin-updater";

export type UpdateState =
  | { kind: "none" }
  | { kind: "available"; update: Update }
  | { kind: "error"; message: string };

export async function checkForUpdate(): Promise<UpdateState> {
  try {
    const update = await check();
    return update ? { kind: "available", update } : { kind: "none" };
  } catch (e) {
    return { kind: "error", message: String(e) };
  }
}

/** Downloads, installs and restarts. `onProgress` gets 0–1 when the size is known. */
export async function installUpdate(update: Update, onProgress?: (p: number) => void) {
  let total = 0, done = 0;
  await update.downloadAndInstall((e) => {
    if (e.event === "Started") total = e.data.contentLength ?? 0;
    if (e.event === "Progress") { done += e.data.chunkLength; if (total) onProgress?.(done / total); }
  });
  await relaunch();
}
