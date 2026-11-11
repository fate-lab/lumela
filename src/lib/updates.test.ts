import { describe, expect, it } from "vitest";
import { oncePerVersion, UPDATE_CHECK_INTERVAL_MS } from "./updates";

describe("oncePerVersion", () => {
  it("tells about a version once and about the next one again", () => {
    const isNew = oncePerVersion();
    expect(isNew("0.1.2")).toBe(true);
    expect(isNew("0.1.2")).toBe(false);
    expect(isNew("0.1.3")).toBe(true);
    expect(isNew("0.1.3")).toBe(false);
  });
});

it("checks again within a day", () => {
  expect(UPDATE_CHECK_INTERVAL_MS).toBeGreaterThan(0);
  expect(UPDATE_CHECK_INTERVAL_MS).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
});
