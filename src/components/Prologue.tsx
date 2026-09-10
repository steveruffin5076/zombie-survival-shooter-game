import { useState } from "react";
import { ChevronRight, SkipForward } from "lucide-react";

interface Slide {
  eyebrow: string;
  title: string;
  body: string[];
}

const SLIDES: Slide[] = [
  {
    eyebrow: "DAY 90 AFTER REDSHIFT",
    title: "THE REDSHIFT INCIDENT",
    body: [
      "Aetheris Dynamics blanketed the world in wireless power — an invisible grid they called The Horizon Frequency. “Lighting Tomorrow, Today.”",
      "Ninety days ago, a rogue script hit that grid. The invisible current shifted into a hyper-intense crimson light. Anyone caught in the open when it happened is gone.",
    ],
  },
  {
    eyebrow: "THE INFECTED",
    title: "PHANTOMS",
    body: [
      "Not corpses. Their nervous systems are hyper-charged by the red light network — eyes locked in a dull crimson glow, higher brain function burned out.",
      "Blind in true darkness. Instantly drawn to any light, or any sound. Your rifle's laser sight hacks the same tracking that hunts them — the instant it crosses one, its focus locks to you.",
    ],
  },
  {
    eyebrow: "THE COMPANY THAT DID THIS",
    title: "AETHERIS DYNAMICS",
    body: [
      "Even after the Redshift error was confirmed, Aetheris leadership refused to cut the grid — it would have killed their stock price. They call survivors like you “system contamination vectors.”",
      "Armored corporate enforcers still patrol what's left of the network. Something in their armor has started to grow.",
    ],
  },
  {
    eyebrow: "YOUR ONLY ADVANTAGE",
    title: "THE HIDEOUT",
    body: [
      "You've found a basement with the doors sealed and a terminal still drawing power. It's not much — but it's yours.",
      "Pick your loadout. Read what intel you find. When you're ready, the terminal shows you where the network is weakest.",
    ],
  },
];

/** One-time story beat shown before the player is dropped into the Hideout. */
export default function Prologue({ onContinue }: { onContinue: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];
  const next = () => (last ? onContinue() : setI((v) => v + 1));

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(127,29,29,0.18),transparent_65%)]" />

      <button
        onClick={onContinue}
        className="absolute right-6 top-6 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] text-zinc-500 transition hover:border-white/25 hover:text-zinc-300"
      >
        SKIP <SkipForward className="h-3 w-3" />
      </button>

      <div key={i} className="anim-rise flex max-w-xl flex-col items-center px-6 text-center">
        <div className="mb-3 flex items-center gap-3 text-[10px] font-bold tracking-[0.4em] text-red-400/70">
          <span className="h-px w-8 bg-red-400/40" />
          {slide.eyebrow}
          <span className="h-px w-8 bg-red-400/40" />
        </div>
        <h2 className="title-blood font-display text-[clamp(2rem,6vw,3.5rem)] leading-none tracking-[0.05em]">
          {slide.title}
        </h2>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
          {slide.body.map((p, k) => (
            <p key={k}>{p}</p>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-2">
        {SLIDES.map((_, k) => (
          <span
            key={k}
            className={`h-1 rounded-full transition-all ${k === i ? "w-6 bg-red-400" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>

      <button
        onClick={next}
        className="group relative mt-8 flex items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-b from-red-600 to-red-800 px-10 py-3.5 text-sm font-bold tracking-[0.2em] text-red-50 shadow-[0_0_40px_rgba(153,27,27,0.4)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_60px_rgba(153,27,27,0.55)] active:scale-[0.98]"
      >
        {last ? "ENTER THE HIDEOUT" : "CONTINUE"}
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
