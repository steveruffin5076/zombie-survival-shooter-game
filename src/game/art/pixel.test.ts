import { describe, expect, it } from "vitest";
import { PixelBuf, rgba } from "./pixel";

describe("rgba", () => {
  it("parses the three hex forms", () => {
    expect(rgba("#f00")).toEqual([255, 0, 0, 255]);
    expect(rgba("#00ff00")).toEqual([0, 255, 0, 255]);
    expect(rgba("#0000ff80")).toEqual([0, 0, 255, 128]);
  });

  it("rejects a malformed color instead of drawing something wrong", () => {
    expect(() => rgba("#12345")).toThrow();
  });
});

describe("PixelBuf", () => {
  it("writes the pixel it is asked to, and only that one", () => {
    const b = new PixelBuf(4, 4);
    b.px(1, 2, "#ff0000");
    expect(b.get(1, 2)).toEqual([255, 0, 0, 255]);
    expect(b.get(2, 1)).toEqual([0, 0, 0, 0]);
  });

  it("drops out-of-bounds writes rather than throwing", () => {
    const b = new PixelBuf(4, 4);
    expect(() => b.px(-1, 0, "#fff").px(9, 9, "#fff")).not.toThrow();
    expect(b.isEmpty()).toBe(true);
  });

  it("composites a translucent pass over an opaque one", () => {
    const b = new PixelBuf(2, 2);
    b.px(0, 0, "#000000");
    b.px(0, 0, "#ffffff80"); // 50% white over black -> mid grey
    const [r, , , a] = b.get(0, 0);
    expect(a).toBe(255);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(155);
  });

  it("fills rect, row and col over the ranges given", () => {
    const b = new PixelBuf(6, 6);
    b.rect(1, 1, 2, 3, "#fff");
    expect(b.get(1, 1)[3]).toBe(255);
    expect(b.get(2, 3)[3]).toBe(255);
    expect(b.get(3, 1)[3]).toBe(0); // width 2 means x=1,2 only

    b.row(0, 5, 5, "#fff");
    expect(b.get(0, 5)[3]).toBe(255);
    expect(b.get(5, 5)[3]).toBe(255);

    b.col(5, 0, 5, "#fff");
    expect(b.get(5, 0)[3]).toBe(255);
  });

  it("rasterizes an oval inside its bounds", () => {
    const b = new PixelBuf(9, 9);
    b.oval(4, 4, 3, 3, "#fff");
    expect(b.get(4, 4)[3]).toBe(255); // centre
    expect(b.get(4, 1)[3]).toBe(255); // top of the vertical radius
    expect(b.get(0, 0)[3]).toBe(0); // corner stays outside
  });

  it("draws a line that reaches both endpoints", () => {
    const b = new PixelBuf(8, 8);
    b.line(0, 0, 7, 7, "#fff");
    expect(b.get(0, 0)[3]).toBe(255);
    expect(b.get(7, 7)[3]).toBe(255);
    expect(b.get(4, 4)[3]).toBe(255);
  });

  it("mirrors the left half onto the right", () => {
    const b = new PixelBuf(6, 2);
    b.px(0, 0, "#ff0000");
    b.mirrorX();
    expect(b.get(5, 0)).toEqual([255, 0, 0, 255]);
  });

  it("outlines the transparent side only, without seeding more outline", () => {
    const b = new PixelBuf(5, 5);
    b.px(2, 2, "#ffffff");
    b.outline("#000000");
    // the four orthogonal neighbours get the border...
    expect(b.get(1, 2)).toEqual([0, 0, 0, 255]);
    expect(b.get(3, 2)).toEqual([0, 0, 0, 255]);
    // ...the body itself is untouched, and the border does not spread further
    expect(b.get(2, 2)).toEqual([255, 255, 255, 255]);
    expect(b.get(0, 2)[3]).toBe(0);
  });

  it("reports empty vs drawn", () => {
    const b = new PixelBuf(3, 3);
    expect(b.isEmpty()).toBe(true);
    b.px(1, 1, "#fff");
    expect(b.isEmpty()).toBe(false);
  });
});
