import { describe, expect, it } from "vitest";
import { isTouchCapable } from "./input";

describe("isTouchCapable", () => {
  it("is true for a real touch device: touch points and a coarse pointer", () => {
    expect(isTouchCapable(5, true)).toBe(true);
  });

  it("is false for a touchscreen laptop driven by a mouse (fine pointer)", () => {
    expect(isTouchCapable(5, false)).toBe(false);
  });

  it("is false when the pointer is coarse but no touch points are reported", () => {
    expect(isTouchCapable(0, true)).toBe(false);
  });

  it("is false for a mouse-only desktop", () => {
    expect(isTouchCapable(0, false)).toBe(false);
  });
});
