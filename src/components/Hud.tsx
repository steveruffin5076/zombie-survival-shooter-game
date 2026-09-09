import type { HudState } from "../game/types";
import { DEPLOYABLE_DEFS, type DeployableKind } from "../game/arena";
import {
  Heart, Skull, Pause, Volume2, VolumeX, Crosshair, Zap, Trophy, Lock,
  Ear, Bot, Hand, DoorOpen, Gem,
} from "lucide-react";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const TOOL_KEYS: { kind: DeployableKind; key: string }[] = [
  { kind: "barricade", key: "1" },
  { kind: "wire", key: "2" },
  { kind: "claymore", key: "3" },
];

interface Props {
  hud: HudState;
  onMute: () => void;
  onPause: () => void;
  onSwitch: (id: string) => void;
  onFireMode: () => void;
  onSelectTool: (kind: DeployableKind) => void;
  touch?: boolean;
}

export default function Hud({ hud, onMute, onPause, onSwitch, onFireMode, onSelectTool, touch = false }: Props) {
  const hpPct = Math.max(0, Math.min(1, hud.hp / hud.maxHp));
  const xpPct = Math.max(0, Math.min(1, hud.xp / hud.xpNext));
  const dashPct = hud.dashMax > 0 ? 1 - Math.max(0, hud.dashT) / hud.dashMax : 1;
  const hpColor =
    hpPct > 0.5
      ? "from-emerald-500 to-lime-400"
      : hpPct > 0.25
        ? "from-amber-500 to-yellow-400"
        : "from-red-600 to-orange-500";

  // z-40 sits above TouchControls (z-30) so the Pause/Mute cluster stays
  // tappable instead of being swallowed by the aim-drag surface. Every other
  // panel here is pointer-events-none, so touch input elsewhere still
  // reaches TouchControls.
  return (
    <div className="pointer-events-none absolute inset-0 z-40 p-6 font-sans">
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

      {/* top-center: stage + wave, or travel progress */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 text-center">
        <div className="text-[10px] font-bold tracking-[0.42em] text-white/45">
          STAGE {hud.stage}
        </div>
        {hud.phase === "prep" ? (
          <>
            <div className="font-display text-2xl tracking-[0.18em] text-emerald-300 drop-shadow-[0_0_14px_rgba(52,211,153,0.45)]">
              PREP — WAVE {Math.max(1, hud.waveInStage + 1)}
            </div>
            <div className="mx-auto mt-1.5 h-1.5 w-56 overflow-hidden rounded-full border border-white/10 bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-300 transition-[width] duration-100"
                style={{ width: `${(hud.prepT / hud.prepMax) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-widest text-white/55">
              {Math.ceil(hud.prepT)}s · <span className="kbd">ENTER</span> READY
            </div>
            <div className="pointer-events-auto mt-2 flex items-center justify-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-slate-400/30 bg-black/60 px-3 py-1.5 text-[11px] font-bold tracking-widest text-slate-200 backdrop-blur-sm">
                <Gem className="h-3.5 w-3.5 text-slate-400" /> {hud.scrap}
              </div>
              {TOOL_KEYS.map(({ kind, key }) => {
                const def = DEPLOYABLE_DEFS[kind];
                const active = hud.placingKind === kind;
                return (
                  <button
                    key={kind}
                    onClick={() => onSelectTool(kind)}
                    title={def.desc}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wide backdrop-blur-sm transition ${
                      active
                        ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                        : "border-white/12 bg-black/50 text-white/60 hover:border-white/30"
                    }`}
                  >
                    <span className="kbd">{key}</span> {def.short}
                  </button>
                );
              })}
            </div>
          </>
        ) : hud.phase === "travel" ? (
          <>
            <div className="font-display text-2xl tracking-[0.18em] text-cyan-300 drop-shadow-[0_0_14px_rgba(103,232,249,0.45)]">
              MOVE OUT
            </div>
            <div className="mx-auto mt-1.5 h-1.5 w-56 overflow-hidden rounded-full border border-white/10 bg-black/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-300 transition-[width] duration-200"
                style={{ width: `${hud.travelDistance * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-widest text-white/55">
              <DoorOpen className="h-3.5 w-3.5" />
              {hud.travelGatesOpened}/{hud.travelGatesTotal} GATES · SAFE HOUSE AHEAD
            </div>
          </>
        ) : (
          <>
            <div
              className={`font-display text-2xl tracking-[0.18em] ${
                hud.isBossWave
                  ? "text-red-400 drop-shadow-[0_0_16px_rgba(239,68,68,0.6)]"
                  : "text-amber-300 drop-shadow-[0_0_14px_rgba(245,158,11,0.45)]"
              }`}
            >
              {hud.isBossWave ? "BOSS WAVE" : `WAVE ${Math.max(1, hud.waveInStage)}`}
            </div>
            {/* per-stage wave pips */}
            <div className="mt-1.5 flex items-center justify-center gap-1">
              {Array.from({ length: hud.wavesPerStage }).map((_, i) => {
                const n = i + 1;
                const done = n < hud.waveInStage;
                const cur = n === hud.waveInStage;
                const boss = hud.bossWaves.includes(n);
                return (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${boss ? "w-3.5" : "w-2.5"} ${
                      cur
                        ? boss
                          ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]"
                          : "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]"
                        : done
                          ? boss ? "bg-red-500/60" : "bg-amber-500/50"
                          : boss ? "bg-red-500/25" : "bg-white/15"
                    }`}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-widest text-white/55">
              <Skull className="h-3.5 w-3.5" />
              {hud.waveInStage > 0 ? `${hud.remaining} REMAIN` : "GET READY"}
            </div>
          </>
        )}
      </div>

      {/* boss bar — 3 segments (one per enrage phase), the attack telegraph, and the E-lock hint */}
      {hud.bossActive && (
        <div className="absolute left-1/2 top-24 w-[420px] -translate-x-1/2">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-[0.2em] text-red-300">
            <span>◤ THE JUGGERNAUT ALPHA ◢</span>
            <span className="text-white/40">
              {hud.bossAttack
                ? hud.bossAttack === "slam" ? "GROUND SLAM" : hud.bossAttack === "mortar" ? "PUKE MORTAR" : "SCREAMING CALL"
                : ""}
            </span>
          </div>
          <div className="relative flex h-2.5 gap-0.5 overflow-hidden rounded-full border border-red-400/25 bg-black/60">
            {[0, 1, 2].map((seg) => {
              const segStart = (2 - seg) / 3;
              const segEnd = (3 - seg) / 3;
              const hpFrac = hud.bossHpMax > 0 ? hud.bossHp / hud.bossHpMax : 0;
              const filled = clamp01((hpFrac - segStart) / (segEnd - segStart));
              return (
                <div key={seg} className="relative h-full flex-1 overflow-hidden bg-black/40">
                  <div
                    className={`h-full transition-[width] duration-150 ${
                      seg === 0 ? "bg-gradient-to-r from-red-600 to-red-400"
                        : seg === 1 ? "bg-gradient-to-r from-orange-600 to-orange-400"
                        : "bg-gradient-to-r from-amber-500 to-yellow-400"
                    }`}
                    style={{ width: `${filled * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
          {hud.bossAttack && (
            <div className="mx-auto mt-1 h-1 w-40 overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full rounded-full bg-red-400 transition-[width] duration-75"
                style={{ width: `${hud.bossWindupPct * 100}%` }}
              />
            </div>
          )}
          <div className={`mt-1 text-center text-[9px] font-bold tracking-widest ${hud.bossForceTarget ? "text-emerald-300" : "text-white/35"}`}>
            <span className="kbd">E</span> {hud.bossForceTarget ? "LOCKED ON BOSS" : "FORCE TARGET"}
          </div>
        </div>
      )}

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
            {hud.arena && (
              <span className="flex items-center gap-1 text-slate-300">
                <Gem className="h-3.5 w-3.5 text-slate-400" /> {hud.scrap}
              </span>
            )}
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

      {/* bottom-left: weapon inventory + ammo */}
      <div className="absolute bottom-6 left-6">
        <div className="mb-2 flex items-end gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-amber-300">
              <Crosshair className="h-4 w-4" />
              {hud.weapon.toUpperCase()}
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] tracking-[0.15em] text-white/55">
                {hud.weaponRole}
              </span>
            </div>
            {/* big ammo readout */}
            <div className="mt-1 flex items-baseline gap-1.5 font-display tabular-nums leading-none">
              <span
                className={`text-4xl tracking-wider transition-colors ${
                  hud.reloading
                    ? "text-amber-400"
                    : hud.ammo === 0
                      ? "text-red-500 animate-pulse"
                      : hud.ammo / hud.mag <= 0.25
                        ? "text-amber-400"
                        : "text-zinc-100"
                }`}
              >
                {String(hud.ammo).padStart(2, "0")}
              </span>
              <span className="text-lg text-white/35">/ {hud.mag}</span>
              <span
                className={`ml-1 text-xs font-semibold ${
                  hud.reserve < 0
                    ? "text-emerald-400"
                    : hud.reserve === 0
                      ? "text-red-400"
                      : "text-white/45"
                }`}
              >
                {hud.reserve < 0 ? "∞" : hud.reserve}
              </span>
            </div>
            {/* reload progress / ammo bar */}
            <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              {hud.reloading ? (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width] duration-75"
                  style={{ width: `${hud.reloadPct * 100}%` }}
                />
              ) : (
                <div
                  className={`h-full rounded-full transition-[width] duration-150 ${
                    hud.ammo / hud.mag <= 0.25 ? "bg-red-500" : "bg-zinc-300"
                  }`}
                  style={{ width: `${(hud.ammo / hud.mag) * 100}%` }}
                />
              )}
            </div>
            <div className="mt-1 h-3 text-[9px] font-bold tracking-[0.25em] text-amber-400/80">
              {hud.reloading ? "RELOADING…" : hud.ammo === 0 ? "PRESS R" : ""}
            </div>

            {/* suppressor durability */}
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`text-[9px] font-bold tracking-[0.15em] ${
                  hud.suppBroken ? "text-red-400" : "text-white/45"
                }`}
              >
                {hud.suppMax >= 999 ? "INTEGRAL SUPP" : hud.suppBroken ? "SUPP BROKEN" : "SUPP"}
              </span>
              {hud.suppMax < 999 && (
                <>
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
                    <div
                      className={`h-full rounded-full ${
                        hud.suppBroken
                          ? "bg-red-600"
                          : hud.supp / hud.suppMax < 0.3
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${(hud.supp / hud.suppMax) * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] tabular-nums text-white/40">{hud.supp}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          {hud.weapons.map((w) => (
            <button
              key={w.cls}
              onClick={() => w.owned && onSwitch(w.cls)}
              disabled={!w.owned}
              className={`relative flex h-16 w-[4.2rem] flex-col items-center justify-center rounded-lg border transition-all duration-150 ${
                w.active
                  ? "border-amber-400/70 bg-amber-400/15 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  : w.owned
                    ? "border-white/12 bg-black/50 hover:border-white/30 hover:bg-white/5"
                    : "border-white/5 bg-black/40 opacity-35"
              }`}
            >
              <span className={`absolute left-1 top-0.5 text-[9px] font-bold ${w.active ? "text-amber-300" : "text-white/35"}`}>
                {w.key}
              </span>
              {w.owned ? (
                <>
                  <span className="text-[7px] font-bold tracking-[0.15em] text-white/35">
                    {w.label}
                  </span>
                  <span className={`text-[9px] font-bold tracking-wide ${w.active ? "text-amber-200" : "text-zinc-300"}`}>
                    {w.short}
                  </span>
                  <span
                    className={`text-[9px] font-semibold tabular-nums ${
                      w.ammo === 0 ? "text-red-400" : w.active ? "text-amber-300/80" : "text-white/40"
                    }`}
                  >
                    {w.ammo}/{w.mag}
                  </span>
                  {w.variants > 1 && (
                    <span className="absolute right-1 top-0.5 text-[8px] font-bold text-cyan-300/70">
                      ×{w.variants}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-white/30" />
                  <span className="mt-0.5 text-[7px] font-bold tracking-[0.15em] text-white/25">
                    {w.label}
                  </span>
                </>
              )}
              {w.active && <span className="mt-0.5 h-0.5 w-8 rounded-full bg-amber-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* right column: fire mode + threat */}
      <div className="absolute bottom-28 right-6 flex flex-col items-end gap-3">
        {/* THREAT METER */}
        <div className="w-44 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[9px] font-bold tracking-[0.2em] text-white/55">
              <Ear className="h-3 w-3" /> NOISE
            </span>
            <span
              className={`text-[9px] font-bold tracking-widest ${
                hud.threat > 0.75 ? "text-red-400 animate-pulse" : "text-white/40"
              }`}
            >
              {hud.threat > 0.75 ? "DETECTED" : hud.threat > 0.4 ? "HEARD" : "QUIET"}
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${
                hud.threat > 0.75
                  ? "bg-gradient-to-r from-red-600 to-red-400"
                  : hud.threat > 0.4
                    ? "bg-gradient-to-r from-amber-600 to-amber-400"
                    : "bg-gradient-to-r from-emerald-700 to-emerald-500"
              }`}
              style={{ width: `${hud.threat * 100}%` }}
            />
            {/* LOOT LOCK tick — bypass/quiet-kill windows close past this threat */}
            <div className="absolute inset-y-0 w-px bg-white/50" style={{ left: "35%" }} />
          </div>
          <div className="relative mt-0.5 h-2.5 text-[7px] font-bold tracking-widest text-white/35">
            <span className="absolute -translate-x-1/2" style={{ left: "35%" }}>LOOT LOCK</span>
          </div>
        </div>

        {/* FIRE MODE TOGGLE */}
        <button
          onClick={onFireMode}
          className={`pointer-events-auto flex w-44 items-center gap-2.5 rounded-xl border px-3 py-2.5 backdrop-blur-sm transition-all active:scale-[0.97] ${
            hud.autoFire
              ? "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20"
          }`}
        >
          {hud.autoFire ? (
            <Bot className="h-5 w-5 text-emerald-300" />
          ) : (
            <Hand className="h-5 w-5 text-amber-300" />
          )}
          <div className="text-left">
            <div
              className={`text-[11px] font-bold tracking-[0.14em] ${
                hud.autoFire ? "text-emerald-200" : "text-amber-200"
              }`}
            >
              {hud.autoFire ? "AUTO-FIRE" : "MANUAL"}
            </div>
            <div className="text-[8px] tracking-[0.12em] text-white/40">
              {hud.autoFire ? "FIRES ON LASER CONTACT" : "CLICK TO SHOOT"}
            </div>
          </div>
          <span className="kbd ml-auto text-[8px]">F</span>
        </button>
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

      {/* bottom-center: crate interact prompt */}
      {hud.crateNear && (
        <div className="absolute bottom-40 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-[0.15em] backdrop-blur-sm ${
              hud.crateLocked
                ? "border-red-400/40 bg-red-950/50 text-red-300"
                : "border-white/15 bg-black/60 text-zinc-200"
            }`}
          >
            {hud.crateLocked ? (
              "TOO LOUD — WAIT FOR QUIET"
            ) : (
              <>
                <span className="kbd">E</span> HOLD TO OPEN
                <span className="text-white/40">· TIER {hud.crateTier}</span>
              </>
            )}
          </div>
          {!hud.crateLocked && hud.crateOpenPct > 0 && (
            <div className="h-1 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-75"
                style={{ width: `${hud.crateOpenPct * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* bottom-center: gate bypass prompt — always optional, never required */}
      {hud.gateBypassNear && !hud.crateNear && (
        <div className="absolute bottom-40 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-[0.15em] backdrop-blur-sm ${
              hud.gateBypassLocked
                ? "border-red-400/40 bg-red-950/50 text-red-300"
                : "border-violet-400/30 bg-violet-950/40 text-violet-200"
            }`}
          >
            {hud.gateBypassLocked ? (
              "TOO LOUD TO SLIP THROUGH"
            ) : (
              <>
                <span className="kbd">E</span> HOLD TO BYPASS QUIETLY
              </>
            )}
          </div>
          {!hud.gateBypassLocked && hud.gateBypassPct > 0 && (
            <div className="h-1 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              <div
                className="h-full rounded-full bg-violet-400 transition-[width] duration-75"
                style={{ width: `${hud.gateBypassPct * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* bottom-center: controls hint */}
      {!touch && hud.stage === 1 && hud.waveInStage <= 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 text-[10px] font-semibold tracking-wider text-white/35">
          <span><span className="kbd">A</span> <span className="kbd">D</span> MOVE + PIVOT LANE</span>
          <span><span className="kbd">W</span> JUMP</span>
          <span><span className="kbd">SHIFT</span> DASH</span>
          <span><span className="kbd">1</span>-<span className="kbd">4</span> CLASS</span>
          <span><span className="kbd">R</span> RELOAD</span>
          <span><span className="kbd">F</span> FIRE MODE</span>
          <span><span className="kbd">E</span> OPEN CRATE</span>
          <span><span className="kbd">I</span> BACKPACK</span>
          <span><span className="kbd">G</span>/<span className="kbd">B</span>/<span className="kbd">N</span>/<span className="kbd">T</span> ITEMS</span>
        </div>
      )}
    </div>
  );
}
