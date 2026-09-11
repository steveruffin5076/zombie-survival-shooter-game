import type { Deployable } from "../game/arena";
import { DEPLOYABLE_DEFS } from "../game/arena";
import { Wrench, Gem } from "lucide-react";

interface Props {
  deployables: Deployable[];
  scrap: number;
  windowT: number;
  windowMax: number;
  onRepair: (id: string) => void;
}

/** Non-blocking panel shown for the first `windowMax` seconds of each arena prep phase. */
export default function RepairPanel({ deployables, scrap, windowT, windowMax, onRepair }: Props) {
  const damaged = deployables.filter((d) => d.hp < d.maxHp);
  if (damaged.length === 0) return null;

  return (
    <div className="pointer-events-none absolute right-6 top-40 z-40 w-56">
      <div className="pointer-events-auto rounded-xl border border-amber-400/30 bg-black/60 p-3 backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.2em] text-amber-300">
            <Wrench className="h-3.5 w-3.5" /> REPAIR WINDOW
          </div>
          <div className="text-[12px] font-bold tabular-nums text-white/50">{Math.ceil(windowT)}s</div>
        </div>
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-100"
            style={{ width: `${(windowT / windowMax) * 100}%` }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {damaged.map((d) => {
            const def = DEPLOYABLE_DEFS[d.kind];
            const affordable = scrap >= def.repairCost;
            return (
              <button
                key={d.id}
                onClick={() => affordable && onRepair(d.id)}
                disabled={!affordable}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[12px] font-bold tracking-wide transition ${
                  affordable
                    ? "border-white/15 bg-white/5 text-zinc-200 hover:border-amber-400/50 hover:bg-amber-400/10"
                    : "border-white/5 bg-black/40 text-white/30"
                }`}
              >
                <span>{def.short} · {Math.round((d.hp / d.maxHp) * 100)}%</span>
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3" /> {def.repairCost}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
