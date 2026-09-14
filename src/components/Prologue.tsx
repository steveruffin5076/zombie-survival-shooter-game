import { Radio, Play } from "lucide-react";
import { RADIO_SCRIPT, type Speaker } from "../game/radio";

const SPEAKER_COLOR: Record<Speaker, string> = {
  RHEE: "#7dd3fc", VALE: "#34d399", DIAZ: "#fb923c", UNK: "#f87171", CREW: "#f87171",
};

/** Story Campaign's opening beat, shown once between clicking STORY CAMPAIGN
 * and the Loadout screen. Pulls Shift 1's own "enter" lines straight from
 * RADIO_SCRIPT rather than duplicating the copy — engine.ts skips re-firing
 * that trigger in-mission for Shift 1 specifically, since the player has
 * already read it here. */
export default function Prologue({ onBegin }: { onBegin: () => void }) {
  const lines = RADIO_SCRIPT.filter((c) => c.shift === 1 && c.trigger === "enter");

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-gradient-to-b from-violet-950/30 via-black/85 to-black/95 py-4 backdrop-blur-[4px]">
      <div className="anim-pop flex w-full max-w-lg flex-col items-center px-8 text-center">
        <div className="anim-rise mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-950/50">
          <Radio className="h-8 w-8 text-violet-300" />
        </div>
        <div className="anim-rise mt-3 text-[13px] font-bold tracking-[0.4em] text-violet-300/70" style={{ animationDelay: "40ms" }}>
          STORY CAMPAIGN
        </div>
        <h2
          className="anim-rise mt-2 font-display text-4xl tracking-[0.08em] text-zinc-100 drop-shadow-[0_0_30px_rgba(167,139,250,0.4)]"
          style={{ animationDelay: "80ms" }}
        >
          21:10 — CLOCK IN
        </h2>

        <div className="anim-rise mt-8 flex w-full flex-col gap-3" style={{ animationDelay: "140ms" }}>
          {lines.map((line, i) => (
            <div
              key={i}
              className="rounded-xl border px-5 py-4 text-left"
              style={{ borderColor: SPEAKER_COLOR[line.speaker] + "40", backgroundColor: "rgba(0,0,0,0.4)" }}
            >
              <div
                className="mb-1.5 text-[11px] font-bold tracking-[0.25em]"
                style={{ color: SPEAKER_COLOR[line.speaker] }}
              >
                {line.speaker}
              </div>
              <p className="text-[15px] leading-relaxed text-zinc-200">{line.text}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onBegin}
          className="anim-rise mt-8 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-violet-400 to-violet-600 px-10 py-3.5 text-base font-bold tracking-[0.22em] text-violet-950 shadow-[0_0_40px_rgba(167,139,250,0.35)] transition-all hover:scale-[1.03] active:scale-[0.98]"
          style={{ animationDelay: "220ms" }}
        >
          <Play className="h-4 w-4" fill="currentColor" />
          BEGIN
        </button>
      </div>
    </div>
  );
}
