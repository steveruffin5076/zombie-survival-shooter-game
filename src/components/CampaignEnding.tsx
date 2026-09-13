import type { CampaignEnding } from "../game/campaign";
import { ENDING_COPY } from "../game/campaign";
import { Home, Radio } from "lucide-react";

/**
 * Story Campaign's closing screen — one of the doc's 5 ending stingers,
 * shown as radio sign-off copy plus the printed card text, in place of the
 * normal GameOver flow (there's nothing to retry; the campaign is over).
 */
export default function CampaignEndingScreen({
  ending, onQuit,
}: { ending: CampaignEnding; onQuit: () => void }) {
  const copy = ENDING_COPY[ending];
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-gradient-to-b from-violet-950/30 via-black/85 to-black/95 py-4 backdrop-blur-[4px]">
      <div className="anim-pop flex w-full max-w-lg flex-col items-center px-8 text-center">
        <div className="anim-rise mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-950/50">
          <Radio className="h-8 w-8 text-violet-300" />
        </div>
        <div className="anim-rise mt-3 text-[13px] font-bold tracking-[0.4em] text-violet-300/70" style={{ animationDelay: "40ms" }}>
          STORY CAMPAIGN — COMPLETE
        </div>
        <h2
          className="anim-rise mt-2 font-display text-5xl tracking-[0.1em] text-zinc-100 drop-shadow-[0_0_30px_rgba(167,139,250,0.4)]"
          style={{ animationDelay: "80ms" }}
        >
          {copy.banner}
        </h2>
        <p className="anim-rise mt-2 text-sm tracking-[0.3em] text-zinc-500" style={{ animationDelay: "120ms" }}>
          {copy.sub.toUpperCase()}
        </p>

        <div className="anim-rise mt-8 w-full rounded-xl border border-white/10 bg-black/40 px-6 py-5" style={{ animationDelay: "180ms" }}>
          <p className="font-display text-lg tracking-[0.05em] text-zinc-300">{copy.card}</p>
        </div>

        <button
          onClick={onQuit}
          className="anim-rise mt-8 flex items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-bold tracking-[0.2em] text-zinc-200 transition-all hover:border-white/25 hover:bg-white/10 active:scale-[0.98]"
          style={{ animationDelay: "240ms" }}
        >
          <Home className="h-4 w-4" />
          MENU
        </button>
      </div>
    </div>
  );
}
