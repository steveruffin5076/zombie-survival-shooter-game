import type { HudState } from "../game/types";
import { Heart, Skull, Pause, Volume2, VolumeX, Crosshair, Zap, Trophy } from "lucide-react";

interface Props {
  hud: HudState;
  onMute: () => void;
  onPause: () => void;
}

export default function Hud({ hud, onMute, onPause }: Props) {
  const hpPct = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const xpPct = Math.max(0, Math.min(1, hud.xp / hud.xpNext));
  const dashPct = hud.dashMax > 0 ? 1 - Math.max(0, hud.dashT) / hud.dashMax : 1;
  const hpColor =
    hpPct > 0.5
      ? "from-emerald-500 to-lime-400"
      : hpPct > 0.25
        ? "from-amber-500 to-yellow-400"
        : "from-red-600 to-orange-500";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 p-6 font-sans">
      {/* top-left: vitals */}
      <div className="absolute left-6 top-6 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm">
            <Heart className={`h-4.5 w-4.5 ${hpPct > 0.25 ? "text-red-400" : "text-red-500 animate-pulse"}`} fill="currentColor" />
          </div>
          <div>
            <div className="h-3.5 w-56 overflow-hidden rounded-full border border-white/10 bg-black/60">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${hpColor} transition-[width] duration-200`}
                style={{ width: `${hpPct * 100}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] font-semibold tracking-widest text-white/50">
              {hud.hp} / {hud.maxHp}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-400/25 bg-black/50 text-[10px] font-bold text-violet-300 backdrop-blur-sm">
            {hud.level}
          </div>
          <div>
            <div className="h-2 w-56 overflow-hidden rounded-full border border-white/10 bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-[width] duration-200"
                style={{ width: `${xpPct * 100}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] font-semibold tracking-widest text-white/50">
              LEVEL {hud.level}
            </div>
          </div>
        </div>
      </div>

      {/* top-center: wave */}
      <div className="absolute left-1/2 top-5 -translate-x-1/2 text-center">
        <div className="font-display text-2xl tracking-[0.18em] text-amber-300 drop-shadow-[0_0_14px_rgba(245,158,11,0.45)]">
          WAVE {String(Math.max(1, hud.wave)).padStart(2, "0")}
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-widest text-white/55">
          <Skull className="h-3.5 w-3.5" />
          {hud.wave > 0 ? `${hud.remaining} REMAIN` : "GET READY"}
        </div>
        {hud.waveTotal > 0 && (
          <div className="mx-auto mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-amber-400/80 transition-[width] duration-300"
              style={{ width: `${(1 - hud.remaining / Math.max(1, hud.waveTotal)) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* top-right: score + controls */}
      <div className="absolute right-6 top-6 flex items-start gap-4">
        <div className="text-right">
          <div className="font-display text-3xl leading-none tracking-wider text-zinc-100 tabular-nums">
            {hud.score.toLocaleString()}
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-3 text-[11px] font-semibold tracking-widest text-white/50">
            <span className="flex items-center gap-1">
              <Skull className="h-3.5 w-3.5" /> {hud.kills}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-400/80" /> {hud.high.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            onClick={onPause}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition hover:border-white/25 hover:text-white"
            aria-label="Pause"
          >
            <Pause className="h-4 w-4" />
          </button>
          <button
            onClick={onMute}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition hover:border-white/25 hover:text-white"
            aria-label="Mute"
          >
            {hud.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* bottom-left: weapon */}
      <div className="absolute bottom-6 left-6">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 backdrop-blur-sm">
          <Crosshair className="h-5 w-5 text-amber-300" />
          <div>
            <div className="text-sm font-bold tracking-wide text-zinc-100">{hud.weapon}</div>
            <div className="mt-1 flex gap-1">
              {Array.from({ length: hud.tierMax }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-4 rounded-full ${i < hud.tier ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]" : "bg-white/15"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* bottom-right: dash */}
      <div className="absolute bottom-6 right-6">
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 backdrop-blur-sm transition-colors ${
            dashPct >= 1 ? "border-cyan-300/30 bg-cyan-950/40" : "border-white/10 bg-black/50"
          }`}
        >
          <Zap className={`h-5 w-5 ${dashPct >= 1 ? "text-cyan-300" : "text-white/30"}`} />
          <div>
            <div className={`text-[10px] font-bold tracking-[0.2em] ${dashPct >= 1 ? "text-cyan-200" : "text-white/40"}`}>
              {dashPct >= 1 ? "DASH READY" : "DASH"}
            </div>
            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${dashPct >= 1 ? "bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" : "bg-white/40"}`}
                style={{ width: `${dashPct * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* bottom-center: controls hint */}
      {hud.wave <= 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 text-[10px] font-semibold tracking-wider text-white/35">
          <span><span className="kbd">A</span> <span className="kbd">D</span> MOVE</span>
          <span><span className="kbd">W</span> JUMP ×2</span>
          <span><span className="kbd">SHIFT</span> DASH</span>
          <span><span className="kbd">MOUSE</span> AIM + FIRE</span>
        </div>
      )}
    </div>
  );
}
