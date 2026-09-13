import type { ChoiceOption } from "../game/types";
import { Radio } from "lucide-react";

/**
 * A binary story choice (Diaz's cottage, the Vault's racks) — structurally
 * like Overlays.tsx's LevelUpModal, but for a narrative fork rather than a
 * build upgrade: no rarity styling, just the two outcomes side by side.
 */
export default function ChoicePrompt({
  prompt, options, onPick,
}: { prompt: string; options: ChoiceOption[]; onPick: (id: string) => void }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center-safe justify-center overflow-y-auto bg-black/80 py-4 backdrop-blur-[6px]">
      <div className="anim-pop w-full max-w-2xl px-8">
        <div className="mb-2 flex items-center justify-center gap-2 text-[13px] font-bold tracking-[0.5em] text-violet-300/80">
          <Radio className="h-3.5 w-3.5" />
          STORY CAMPAIGN
        </div>
        <p className="mb-8 text-center text-xl font-semibold leading-relaxed text-zinc-100">
          {prompt}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {options.map((o, i) => (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className="anim-rise group relative rounded-2xl border border-violet-400/25 bg-zinc-950/90 px-6 py-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-violet-400/50 hover:bg-violet-500/10"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="text-lg font-bold tracking-wide text-zinc-100 group-hover:text-violet-200">
                {o.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
