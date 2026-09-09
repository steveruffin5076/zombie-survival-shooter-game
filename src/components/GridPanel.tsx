import { useRef, useState } from "react";
import type { InventoryItem } from "../game/types";
import { ITEMS } from "../game/items";
import { ICONS, RARITY_STYLE } from "./ui";

interface Props {
  items: InventoryItem[];
  size: { w: number; h: number };
  /** attempts to move an item to a cell; returns whether the move was accepted */
  onMove: (id: string, x: number, y: number) => boolean;
  cell?: number;
}

/**
 * A 4x4-ish item grid driven entirely by pointer events (not HTML5 drag/drop —
 * that API doesn't play well with touch or with a canvas game running underneath).
 */
export default function GridPanel({ items, size, onMove, cell = 56 }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  const cellFromClient = (clientX: number, clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor((clientX - rect.left) / cell);
    const y = Math.floor((clientY - rect.top) / cell);
    return { x, y };
  };

  const onItemPointerDown = (e: React.PointerEvent, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragId(id);
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragId) return;
    const cellPos = cellFromClient(
      e.clientX - dragOffset.current.x + cell / 2,
      e.clientY - dragOffset.current.y + cell / 2
    );
    if (cellPos) onMove(dragId, cellPos.x, cellPos.y);
    setDragId(null);
  };

  return (
    <div
      ref={gridRef}
      className="relative select-none"
      style={{ width: size.w * cell, height: size.h * cell }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* cell grid background */}
      {Array.from({ length: size.w * size.h }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-md border border-white/10 bg-white/[0.03]"
          style={{
            left: (i % size.w) * cell + 2,
            top: Math.floor(i / size.w) * cell + 2,
            width: cell - 4,
            height: cell - 4,
          }}
        />
      ))}

      {items.map((it) => {
        const def = ITEMS[it.itemId];
        if (!def) return null;
        const Icon = ICONS[def.icon] ?? ICONS.Crosshair;
        const r = RARITY_STYLE[def.rarity];
        const dragging = dragId === it.id;
        const style: React.CSSProperties = dragging
          ? {
              position: "fixed", left: dragPos.x - dragOffset.current.x, top: dragPos.y - dragOffset.current.y,
              width: def.w * cell - 4, height: def.h * cell - 4, zIndex: 50, pointerEvents: "none",
            }
          : {
              position: "absolute", left: it.x * cell + 2, top: it.y * cell + 2,
              width: def.w * cell - 4, height: def.h * cell - 4,
            };
        return (
          <div
            key={it.id}
            onPointerDown={(e) => onItemPointerDown(e, it.id)}
            className={`group flex cursor-grab flex-col items-center justify-center gap-0.5 rounded-md border bg-zinc-950/90 transition-transform active:cursor-grabbing ${r.border} ${dragging ? "scale-105 shadow-2xl" : ""}`}
            style={style}
            title={`${def.name} — ${def.desc}`}
          >
            <Icon className="h-4 w-4 text-zinc-200" />
            <span className="text-[7px] font-bold tracking-wide text-zinc-400">{def.short}</span>
          </div>
        );
      })}
    </div>
  );
}
