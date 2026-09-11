import type { InventorySnapshot } from "../game/types";
import { CONSUMABLE_ITEMS, ITEMS } from "../game/items";
import { X } from "lucide-react";
import GridPanel from "./GridPanel";
import { ICONS } from "./ui";

interface Props {
  inv: InventorySnapshot;
  onMove: (id: string, x: number, y: number) => boolean;
  onClose: () => void;
}

/** A lightweight, non-blocking backpack viewer — toggled with I, doesn't pause the sim. */
export default function InventoryOverlay({ inv, onMove, onClose }: Props) {
  return (
    <div className="pointer-events-auto absolute right-6 top-24 z-40 w-80 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold tracking-[0.25em] text-zinc-300">
          BACKPACK
          <span className="text-[11px] font-semibold text-zinc-500">4×4</span>
        </div>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white"
          aria-label="Close inventory"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex justify-center rounded-xl border border-white/10 bg-black/40 p-2">
        <GridPanel items={inv.backpack} size={inv.backpackSize} onMove={onMove} cell={52} />
      </div>

      <div className="mt-3 flex items-center justify-end text-[12px] font-semibold text-zinc-500">
        <span>{inv.deposit.length} IN STASH</span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {CONSUMABLE_ITEMS.map((id) => {
          const def = ITEMS[id];
          const count = inv.backpack.filter((it) => it.itemId === id).length;
          const Icon = ICONS[def.icon] ?? ICONS.Crosshair;
          return (
            <div
              key={id}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 ${
                count > 0 ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/5 bg-white/[0.02] opacity-40"
              }`}
              title={def.desc}
            >
              <Icon className="h-3.5 w-3.5 text-cyan-200" />
              <span className="kbd text-[10px]">{def.hotkey}</span>
              <span className="text-[11px] font-bold tabular-nums text-zinc-300">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
