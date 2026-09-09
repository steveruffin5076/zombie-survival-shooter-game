/** Pure Tetris-lite grid packing for the backpack. No DOM, no engine state. */

export interface GridSize {
  w: number;
  h: number;
}

export interface ItemShape {
  w: number;
  h: number;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
}

/** Decisions locked: backpack is a fixed 4x4 grid — no upgrades yet. */
export const BACKPACK_SIZE: GridSize = { w: 4, h: 4 };

export function cellsOf(x: number, y: number, shape: ItemShape): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < shape.h; dy++) {
    for (let dx = 0; dx < shape.w; dx++) cells.push({ x: x + dx, y: y + dy });
  }
  return cells;
}

export function inBounds(size: GridSize, x: number, y: number, shape: ItemShape): boolean {
  return x >= 0 && y >= 0 && x + shape.w <= size.w && y + shape.h <= size.h;
}

function overlaps(
  ax: number, ay: number, aShape: ItemShape,
  bx: number, by: number, bShape: ItemShape
): boolean {
  return ax < bx + bShape.w && ax + aShape.w > bx && ay < by + bShape.h && ay + aShape.h > by;
}

/** Can `shape` be placed at (x,y) without going out of bounds or overlapping another item? */
export function canPlace(
  size: GridSize,
  items: PlacedItem[],
  shapeOf: (itemId: string) => ItemShape,
  x: number,
  y: number,
  shape: ItemShape,
  ignoreId?: string
): boolean {
  if (!inBounds(size, x, y, shape)) return false;
  for (const it of items) {
    if (it.id === ignoreId) continue;
    if (overlaps(x, y, shape, it.x, it.y, shapeOf(it.itemId))) return false;
  }
  return true;
}

/** First free slot (reading order, top-left to bottom-right) that fits `shape`, or null. */
export function findFreeSlot(
  size: GridSize,
  items: PlacedItem[],
  shapeOf: (itemId: string) => ItemShape,
  shape: ItemShape
): { x: number; y: number } | null {
  for (let y = 0; y <= size.h - shape.h; y++) {
    for (let x = 0; x <= size.w - shape.w; x++) {
      if (canPlace(size, items, shapeOf, x, y, shape)) return { x, y };
    }
  }
  return null;
}

/** Places a new item at the first free slot. Returns the new array, or null if it doesn't fit. */
export function placeItem(
  size: GridSize,
  items: PlacedItem[],
  shapeOf: (itemId: string) => ItemShape,
  newItem: Omit<PlacedItem, "x" | "y">
): PlacedItem[] | null {
  const shape = shapeOf(newItem.itemId);
  const slot = findFreeSlot(size, items, shapeOf, shape);
  if (!slot) return null;
  return [...items, { ...newItem, x: slot.x, y: slot.y }];
}

export function removeItem(items: PlacedItem[], id: string): PlacedItem[] {
  return items.filter((it) => it.id !== id);
}

/** Moves an existing item to (x,y). Returns the new array, or null if the move is illegal. */
export function moveItem(
  size: GridSize,
  items: PlacedItem[],
  shapeOf: (itemId: string) => ItemShape,
  id: string,
  x: number,
  y: number
): PlacedItem[] | null {
  const item = items.find((it) => it.id === id);
  if (!item) return null;
  const shape = shapeOf(item.itemId);
  if (!canPlace(size, items, shapeOf, x, y, shape, id)) return null;
  return items.map((it) => (it.id === id ? { ...it, x, y } : it));
}
