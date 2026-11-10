// Shortcut strings use KeyboardEvent.code names joined with "+", e.g. "ctrl+shift+Digit2",
// which the Rust global-hotkey parser accepts as-is.

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight",
]);

export interface KeyLike { code: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }

/**
 * Builds a shortcut from a key event. Returns null while only modifiers are held,
 * or for keys that would be unusable as a global shortcut without a modifier.
 */
export function fromEvent(e: KeyLike): string | null {
  if (MODIFIER_CODES.has(e.code)) return null;
  const mods = [e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", e.metaKey && "super"].filter(Boolean) as string[];
  const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(e.code) || e.code === "PrintScreen";
  if (mods.length === 0 && !isFunctionKey) return null;
  // Shift alone plus a letter or digit would steal ordinary typing.
  if (mods.length === 1 && mods[0] === "shift" && !isFunctionKey) return null;
  return [...mods, e.code].join("+");
}

/** "ctrl+shift+Digit2" → "Ctrl+Shift+2" */
export function display(shortcut: string): string {
  return shortcut
    .split("+")
    .map((p) => {
      switch (p.toLowerCase()) {
        case "ctrl": case "control": return "Ctrl";
        case "shift": return "Shift";
        case "alt": case "option": return "Alt";
        case "super": case "cmd": case "command": case "meta": return "Win";
        default: return p.replace(/^Digit/, "").replace(/^Key/, "");
      }
    })
    .join("+");
}
