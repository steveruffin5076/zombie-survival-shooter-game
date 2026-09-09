import { describe, expect, it } from "vitest";
import {
  BACKPACK_SIZE, canPlace, findFreeSlot, inBounds, moveItem, placeItem, removeItem,
  type ItemShape, type PlacedItem,
} from "./grid";

const shapes: Record<string, ItemShape> = {
  small: { w: 1, h: 1 },
  wide: { w: 2, h: 1 },
  big: { w: 2, h: 2 },
};
const shapeOf = (itemId: string) => shapes[itemId];

describe("inBounds", () => {
  it("accepts a shape fully inside the grid", () => {
    expect(inBounds(BACKPACK_SIZE, 2, 2, shapes.big)).toBe(true);
  });
  it("rejects a shape that runs off the right/bottom edge", () => {
    expect(inBounds(BACKPACK_SIZE, 3, 3, shapes.big)).toBe(false);
  });
  it("rejects negative coordinates", () => {
    expect(inBounds(BACKPACK_SIZE, -1, 0, shapes.small)).toBe(false);
  });
});

describe("canPlace", () => {
  it("allows placing into an empty grid", () => {
    expect(canPlace(BACKPACK_SIZE, [], shapeOf, 0, 0, shapes.big)).toBe(true);
  });
  it("rejects overlap with an existing item", () => {
    const items: PlacedItem[] = [{ id: "a", itemId: "big", x: 0, y: 0 }];
    expect(canPlace(BACKPACK_SIZE, items, shapeOf, 1, 1, shapes.small)).toBe(false);
  });
  it("allows two items that only touch edges, not overlap", () => {
    const items: PlacedItem[] = [{ id: "a", itemId: "big", x: 0, y: 0 }];
    expect(canPlace(BACKPACK_SIZE, items, shapeOf, 2, 0, shapes.small)).toBe(true);
  });
  it("ignores the item's own id when checking a move", () => {
    const items: PlacedItem[] = [{ id: "a", itemId: "small", x: 0, y: 0 }];
    expect(canPlace(BACKPACK_SIZE, items, shapeOf, 0, 0, shapes.small, "a")).toBe(true);
  });
});

describe("findFreeSlot", () => {
  it("finds the top-left-most fit in an empty grid", () => {
    expect(findFreeSlot(BACKPACK_SIZE, [], shapeOf, shapes.small)).toEqual({ x: 0, y: 0 });
  });
  it("skips occupied cells", () => {
    const items: PlacedItem[] = [{ id: "a", itemId: "big", x: 0, y: 0 }];
    expect(findFreeSlot(BACKPACK_SIZE, items, shapeOf, shapes.small)).toEqual({ x: 2, y: 0 });
  });
  it("returns null when nothing fits", () => {
    const items: PlacedItem[] = [
      { id: "a", itemId: "big", x: 0, y: 0 },
      { id: "b", itemId: "big", x: 2, y: 0 },
      { id: "c", itemId: "big", x: 0, y: 2 },
      { id: "d", itemId: "big", x: 2, y: 2 },
    ];
    expect(findFreeSlot(BACKPACK_SIZE, items, shapeOf, shapes.small)).toBeNull();
  });
});

describe("placeItem / removeItem", () => {
  it("places a new item into the first free slot", () => {
    const result = placeItem(BACKPACK_SIZE, [], shapeOf, { id: "a", itemId: "wide" });
    expect(result).toEqual([{ id: "a", itemId: "wide", x: 0, y: 0 }]);
  });
  it("returns null instead of a partially-placed item when the grid is full", () => {
    const items: PlacedItem[] = [
      { id: "a", itemId: "big", x: 0, y: 0 },
      { id: "b", itemId: "big", x: 2, y: 0 },
      { id: "c", itemId: "big", x: 0, y: 2 },
      { id: "d", itemId: "big", x: 2, y: 2 },
    ];
    expect(placeItem(BACKPACK_SIZE, items, shapeOf, { id: "e", itemId: "small" })).toBeNull();
  });
  it("removeItem drops only the matching id", () => {
    const items: PlacedItem[] = [
      { id: "a", itemId: "small", x: 0, y: 0 },
      { id: "b", itemId: "small", x: 1, y: 0 },
    ];
    expect(removeItem(items, "a")).toEqual([{ id: "b", itemId: "small", x: 1, y: 0 }]);
  });
});

describe("moveItem", () => {
  it("moves an item to a legal free cell", () => {
    const items: PlacedItem[] = [{ id: "a", itemId: "small", x: 0, y: 0 }];
    expect(moveItem(BACKPACK_SIZE, items, shapeOf, "a", 3, 3)).toEqual([
      { id: "a", itemId: "small", x: 3, y: 3 },
    ]);
  });
  it("refuses to move an item onto another item", () => {
    const items: PlacedItem[] = [
      { id: "a", itemId: "small", x: 0, y: 0 },
      { id: "b", itemId: "small", x: 1, y: 0 },
    ];
    expect(moveItem(BACKPACK_SIZE, items, shapeOf, "a", 1, 0)).toBeNull();
  });
  it("returns null for an unknown id", () => {
    expect(moveItem(BACKPACK_SIZE, [], shapeOf, "ghost", 0, 0)).toBeNull();
  });
});
