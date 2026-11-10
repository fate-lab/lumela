import { describe, expect, it } from "vitest";
import { display, fromEvent } from "./shortcut";

const ev = (code: string, m: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...m,
});

describe("fromEvent", () => {
  it("builds modifier + code", () => {
    expect(fromEvent(ev("Digit2", { ctrlKey: true, shiftKey: true }))).toBe("ctrl+shift+Digit2");
    expect(fromEvent(ev("KeyS", { altKey: true }))).toBe("alt+KeyS");
  });
  it("waits while only modifiers are held", () => {
    expect(fromEvent(ev("ShiftLeft", { shiftKey: true }))).toBeNull();
  });
  it("rejects plain keys and shift+letter, allows function keys", () => {
    expect(fromEvent(ev("KeyA"))).toBeNull();
    expect(fromEvent(ev("KeyA", { shiftKey: true }))).toBeNull();
    expect(fromEvent(ev("F8"))).toBe("F8");
    expect(fromEvent(ev("PrintScreen", { shiftKey: true }))).toBe("shift+PrintScreen");
  });
});

describe("display", () => {
  it("is human readable", () => {
    expect(display("ctrl+shift+Digit2")).toBe("Ctrl+Shift+2");
    expect(display("super+KeyX")).toBe("Win+X");
  });
});
