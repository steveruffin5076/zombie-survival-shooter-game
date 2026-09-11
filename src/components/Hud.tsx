import type { HudState, InventorySnapshot } from "../game/types";
import { DEPLOYABLE_DEFS, type DeployableKind } from "../game/arena";
import { ATTACK_LABELS } from "../game/boss";
import { CONSUMABLE_ITEMS, ITEMS, type ConsumableKey } from "../game/items";
import { ICONS } from "./ui";
import {
  Heart, Skull, Pause, Volume2, VolumeX, Crosshair, Zap, Trophy, Lock,
  Bot, Hand, Gem,
} from "lucide-react";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const TOOL_KEYS: { kind: DeployableKind; key: string }[] = [
  { kind: "barricade", key: "1" },
  { kind: "wire", key: "2" },
  { kind: "claymore", key: "3" },
];

interface Props {
  hud: HudState;
  inv: InventorySnapshot;
  onMute: () => void;
  onPause: () => void;
  onSwitch: (id: string) => void;
  onFireMode: () => void;
  onSelectTool: (kind: DeployableKind) => void;
  onUseItem: (key: ConsumableKey) => void;
  touch?: boolean;
}

export default function Hud({ hud, inv, onMute, onPause, onSwitch, onFireMode, onSelectTool, onUseItem, touch = false }: Props) {
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
    <div className="pointer-events-none absolute inset-0 z-40 p-3 font-sans md:p-6">
      {/* top-left: vitals */}
      <div className="absolute left-3 top-3 flex flex-col gap-1.5 md:left-6 md:top-6 md:gap-2.5">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm md:h-9 md:w-9">
            <Heart className={`h-3 w-3 md:h-4.5 md:w-4.5 ${hpPct > 0.25 ? "text-red-400" : "text-red-500 animate-pulse"}`} fill="currentColor" />
          </div>
          <div>
            <div className="h-2 w-40 overflow-hidden rounded-full border border-white/10 bg-black/60 md:h-3.5 md:w-56">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${hpColor} transition-[width] duration-200`}
                style={{ width: `${hpPct * 100}%` }}
              />
            </div>
            <div className="mt-0.5 text-[8px] font-semibold tracking-widest text-white/50 md:mt-1 md:text-[10px]">
              {hud.hp} / {hud.maxHp}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/25 bg-black/50 text-[8px] font-bold text-violet-300 backdrop-blur-sm md:h-9 md:w-9 md:text-[10px]">
            {hud.level}
          </div>
          <div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full border border-white/10 bg-black/60 md:h-2 md:w-56">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-[width] duration-200"
                style={{ width: `${xpPct * 100}%` }}
              />
            </div>
            <div className="mt-0.5 text-[7px] font-semibold tracking-widest text-white/50 md:mt-1 md:text-[10px]">
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
        <div className="text-sm font-semibold text-white">{hud.stageName}</div>
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
                const affordable = hud.scrap >= def.buildCost;
                return (
                  <button
                    key={kind}
                    onClick={() => onSelectTool(kind)}
                    title={`${def.desc} — ${def.buildCost} scrap`}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wide backdrop-blur-sm transition ${
                      active
                        ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
                        : affordable
                          ? "border-white/12 bg-black/50 text-white/60 hover:border-white/30"
                          : "border-white/5 bg-black/40 text-white/25"
                    }`}
                  >
                    <span className="kbd">{key}</span> {def.short}
                    <span className={affordable ? "text-slate-400" : "text-red-400/70"}>{def.buildCost}</span>
                  </button>
                );
              })}
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
            <span>{hud.bossName ? `◤ ${hud.bossName} ◢` : ""}</span>
            <span className="text-white/40">{hud.bossAttack ? ATTACK_LABELS[hud.bossAttack] : ""}</span>
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
      <div className="absolute right-3 top-3 flex items-start gap-1 md:right-6 md:top-6 md:gap-4">
        <div className="text-right">
          <div className="font-display text-xl leading-none tracking-wider text-zinc-100 tabular-nums md:text-3xl">
            {hud.score.toLocaleString()}
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-1 text-[7px] font-semibold tracking-widest text-white/50 md:mt-1.5 md:gap-3 md:text-[11px]">
            <span className="flex items-center gap-0.5 md:gap-1">
              <Skull className="h-2 w-2 md:h-3.5 md:w-3.5" /> {hud.kills}
            </span>
            <span className="hidden gap-0.5 md:flex md:gap-1">
              <Trophy className="h-2.5 w-2.5 text-amber-400/80 md:h-3.5 md:w-3.5" /> {hud.high.toLocaleString()}
            </span>
            {hud.arena && (
              <span className="hidden gap-0.5 text-slate-300 md:flex md:gap-1">
                <Gem className="h-2.5 w-2.5 text-slate-400 md:h-3.5 md:w-3.5" /> {hud.scrap}
              </span>
            )}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col gap-1 md:gap-2">
          <button
            onClick={onPause}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition hover:border-white/25 hover:text-white md:h-9 md:w-9"
            aria-label="Pause"
          >
            <Pause className="h-3 w-3 md:h-4 md:w-4" />
          </button>
          <button
            onClick={onMute}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white/70 backdrop-blur-sm transition hover:border-white/25 hover:text-white md:h-9 md:w-9"
            aria-label="Mute"
          >
            {hud.muted ? <VolumeX className="h-3 w-3 md:h-4 md:w-4" /> : <Volume2 className="h-3 w-3 md:h-4 md:w-4" />}
          </button>
        </div>
      </div>

      {/* bottom-left: weapon inventory + ammo */}
      <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6">
        <div className="mb-1 flex items-end gap-2 md:mb-2 md:gap-3">
          <div>
            <div className="flex items-center gap-1 text-[8px] font-bold tracking-[0.2em] text-amber-300 md:gap-2 md:text-[11px]">
              <Crosshair className="h-3 w-3 md:h-4 md:w-4" />
              {hud.weapon.toUpperCase()}
              <span className="rounded bg-white/10 px-1 py-0.5 text-[6px] tracking-[0.15em] text-white/55 md:px-1.5 md:text-[8px]">
                {hud.weaponRole}
              </span>
            </div>
            {/* big ammo readout */}
            <div className="mt-0.5 flex items-baseline gap-1 font-display tabular-nums leading-none md:mt-1 md:gap-1.5">
              <span
                className={`text-2xl tracking-wider transition-colors md:text-4xl ${
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
              <span className="text-sm text-white/35 md:text-lg">/ {hud.mag}</span>
              <span
                className={`ml-0.5 text-[10px] font-semibold md:ml-1 md:text-xs ${
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
            <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10 md:mt-1.5 md:h-1.5 md:w-40">
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
            <div className="mt-0.5 h-2 text-[7px] font-bold tracking-[0.25em] text-amber-400/80 md:mt-1 md:h-3 md:text-[9px]">
              {hud.reloading ? "RELOADING…" : hud.ammo === 0 ? "PRESS R" : ""}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-1 md:gap-2">
          {hud.weapons.map((w) => (
            <button
              key={w.cls}
              onClick={() => w.owned && onSwitch(w.cls)}
              disabled={!w.owned}
              className={`relative flex h-12 w-14 flex-col items-center justify-center rounded-lg border text-[8px] transition-all duration-150 md:h-16 md:w-[4.2rem] md:text-[9px] ${
                w.active
                  ? "border-amber-400/70 bg-amber-400/15 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  : w.owned
                    ? "border-white/12 bg-black/50 hover:border-white/30 hover:bg-white/5"
                    : "border-white/5 bg-black/40 opacity-35"
              }`}
            >
              <span className={`absolute left-0.5 top-0 text-[7px] font-bold md:left-1 md:top-0.5 ${w.active ? "text-amber-300" : "text-white/35"}`}>
                {w.key}
              </span>
              {w.owned ? (
                <>
                  <span className="text-[6px] font-bold tracking-[0.15em] text-white/35 md:text-[7px]">
                    {w.label}
                  </span>
                  <span className={`text-[7px] font-bold tracking-wide md:text-[9px] ${w.active ? "text-amber-200" : "text-zinc-300"}`}>
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

      {/* right column: consumable slots + fire mode */}
      <div className="absolute bottom-32 right-3 flex flex-col items-end gap-1.5 md:bottom-28 md:right-6 md:gap-3">
        {/* CONSUMABLE SLOTS — hidden on mobile, visible on desktop */}
        <div className="pointer-events-auto hidden gap-2 md:flex w-44 justify-end">
          {CONSUMABLE_ITEMS.map((id) => {
            const def = ITEMS[id];
            const count = inv.backpack.filter((it) => it.itemId === id).length;
            const Icon = ICONS[def.icon] ?? ICONS.Crosshair;
            const has = count > 0;
            return (
              <button
                key={id}
                onClick={() => has && onUseItem(def.hotkey!)}
                disabled={!has}
                title={def.desc}
                className={`relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border backdrop-blur-sm transition ${
                  has
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:border-cyan-400/70"
                    : "border-white/10 bg-black/40 text-white/25"
                }`}
              >
                <span className="absolute left-1 top-0.5 text-[8px] font-bold text-white/40">{def.hotkey}</span>
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-bold tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {/* FIRE MODE TOGGLE */}
        <button
          onClick={onFireMode}
          className={`pointer-events-auto flex w-40 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[9px] backdrop-blur-sm transition-all active:scale-[0.97] md:w-44 md:gap-2.5 md:px-3 md:py-2.5 md:text-[11px] ${
            hud.autoFire
              ? "border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20"
          }`}
        >
          {hud.autoFire ? (
            <Bot className="h-4 w-4 md:h-5 md:w-5 text-emerald-300" />
          ) : (
            <Hand className="h-4 w-4 md:h-5 md:w-5 text-amber-300" />
          )}
          <div className="text-left">
            <div
              className={`hidden font-bold tracking-[0.14em] md:block ${
                hud.autoFire ? "text-emerald-200" : "text-amber-200"
              }`}
            >
              {hud.autoFire ? "AUTO-FIRE" : "MANUAL"}
            </div>
            <div className="text-[7px] tracking-[0.12em] text-white/40 md:text-[8px]">
              {hud.autoFire ? "FIRES ON LASER" : "CLICK TO SHOOT"}
            </div>
          </div>
          <span className="kbd ml-auto text-[7px] md:text-[8px]">F</span>
        </button>
      </div>

      {/* bottom-right: dash */}
      <div className="absolute bottom-3 right-3 md:bottom-6 md:right-6">
        <div
          className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-[8px] backdrop-blur-sm transition-colors md:gap-3 md:px-4 md:py-2.5 md:text-[10px] ${
            dashPct >= 1 ? "border-cyan-300/30 bg-cyan-950/40" : "border-white/10 bg-black/50"
          }`}
        >
          <Zap className={`h-4 w-4 md:h-5 md:w-5 ${dashPct >= 1 ? "text-cyan-300" : "text-white/30"}`} />
          <div>
            <div className={`font-bold tracking-[0.2em] ${dashPct >= 1 ? "text-cyan-200" : "text-white/40"}`}>
              {dashPct >= 1 ? "DASH READY" : "DASH"}
            </div>
            <div className="mt-0.5 h-1 w-16 overflow-hidden rounded-full bg-white/10 md:mt-1 md:h-1.5 md:w-24">
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
        <div className="absolute bottom-32 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 md:bottom-40 md:gap-1.5">
          <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2 py-1 text-[8px] font-bold tracking-[0.15em] backdrop-blur-sm text-zinc-200 md:gap-2 md:px-4 md:py-1.5 md:text-[11px]">
            <span className="kbd">E</span> HOLD TO OPEN
            <span className="text-white/40">· TIER {hud.crateTier}</span>
          </div>
          {hud.crateOpenPct > 0 && (
            <div className="h-0.5 w-24 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10 md:h-1 md:w-32">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-75"
                style={{ width: `${hud.crateOpenPct * 100}%` }}
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
          <span><span className="kbd">G</span>/<span className="kbd">B</span>/<span className="kbd">T</span> ITEMS</span>
        </div>
      )}
    </div>
  );
}
