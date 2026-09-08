import { describe, expect, it } from "vitest";
import { canvasPointFromClient, isTouchCapable } from "./input";

describe("canvasPointFromClient", () => {
  it("maps a client point at the canvas origin to (0,0)", () => {
    const rect = { left: 100, top: 50, width: 1280, height: 720 };
    expect(canvasPointFromClient(100, 50, rect, 1280, 720)).toEqual({ x: 0, y: 0 });
  });

  it("maps a client point at the canvas center to (W/2, H/2)", () => {
    const rect = { left: 100, top: 50, width: 1280, height: 720 };
    expect(canvasPointFromClient(100 + 640, 50 + 360, rect, 1280, 720)).toEqual({ x: 640, y: 360 });
  });

  it("scales when the on-screen rect is smaller than the logical canvas", () => {
    // rect is 640x360 on screen but logical space is 1280x720 -> 2x scale
    const rect = { left: 0, top: 0, width: 640, height: 360 };
    expect(canvasPointFromClient(320, 180, rect, 1280, 720)).toEqual({ x: 640, y: 360 });
  });

  it("returns the origin instead of NaN for a zero-size rect", () => {
    const rect = { left: 0, top: 0, width: 0, height: 0 };
    expect(canvasPointFromClient(320, 180, rect, 1280, 720)).toEqual({ x: 0, y: 0 });
  });
});

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
