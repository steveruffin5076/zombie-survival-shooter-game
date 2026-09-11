import { useState } from "react";
import type { ProfileSnapshot } from "../game/types";
import { WEAPONS, CLASS_ORDER, CLASS_LABEL, byClass, type WeaponClass } from "../game/weapons";
import { WEAPON_UNLOCK_LEVEL } from "../game/progression";
import { ZOMBIE_INFO } from "../game/zombieInfo";
import { X, Play, Crosshair, Lock, Skull, Waves, Gem, Star, Gauge, Swords } from "lucide-react";

type Tab = "loadout" | "profile" | "zombies";
const TABS: Tab[] = ["loadout", "profile", "zombies"];

interface Props {
  profile: ProfileSnapshot;
  onClose: () => void;
  onStart: () => void;
  onSelectLoadout: (weaponId: string) => void;
  /** button label + icon context — "START" before a run, "CONTINUE" between stages */
  ctaLabel?: string;
}

/** Opened from the Menu before an Endless run starts, and again between stages so
 * a level-up mid-run can actually be put to use — no more campaign, no walkable
 * hideout: just the weapon loadout (gated by lifetime meta level) and lifetime stats. */
export default function LoadoutProfile({ profile, onClose, onStart, onSelectLoadout, ctaLabel = "START" }: Props) {
  const [tab, setTab] = useState<Tab>("loadout");
  const xpPct = Math.max(0, Math.min(1, profile.metaXp / profile.metaXpNext));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-[6px]">
      <div className="anim-pop relative flex h-[520px] w-full max-w-3xl flex-col rounded-xl border border-amber-500/20 bg-zinc-950/95 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 mt-6 px-6 text-[12px] font-bold tracking-[0.4em] text-amber-400/70">
          LEVEL {profile.metaLevel} · SURVIVOR PROFILE
        </div>

        <div className="flex items-center gap-1 border-b border-white/10 px-6">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-t-lg px-4 py-2 text-sm font-bold tracking-[0.15em] transition ${
                tab === k ? "bg-amber-500/15 text-amber-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center overflow-y-auto p-6">
          {tab === "loadout" && (
            <div className="flex w-full flex-col items-center gap-5">
              <div className="text-[12px] font-bold tracking-[0.3em] text-zinc-500">
                PICK YOUR STARTING WEAPON PER CLASS
              </div>
              {CLASS_ORDER.map((cls) => (
                <ClassRow
                  key={cls}
                  cls={cls}
                  metaLevel={profile.metaLevel}
                  active={profile.equipped[cls]}
                  onPick={onSelectLoadout}
                />
              ))}
            </div>
          )}

          {tab === "profile" && (
            <div className="flex w-full flex-col items-center gap-6 pt-2">
              <div className="w-full max-w-sm">
                <div className="mb-1 flex items-center justify-between text-[12px] font-bold tracking-[0.2em] text-amber-300">
                  <span>LEVEL {profile.metaLevel}</span>
                  <span className="text-zinc-500">{Math.round(profile.metaXp)} / {profile.metaXpNext} XP</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-[width] duration-200"
                    style={{ width: `${xpPct * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid w-full max-w-sm grid-cols-3 gap-3">
                <StatTile icon={<Skull className="h-4 w-4" />} label="KILLS" value={profile.totalKills.toLocaleString()} />
                <StatTile icon={<Waves className="h-4 w-4" />} label="BEST WAVE" value={String(profile.bestWave)} />
                <StatTile icon={<Gem className="h-4 w-4" />} label="SCRAP" value={profile.totalScrap.toLocaleString()} />
              </div>

              <div className="max-w-sm text-center text-sm leading-relaxed text-zinc-600">
                Kills, waves survived, and scrap all feed your level — every level up
                permanently unlocks a new weapon somewhere in your loadout.
              </div>
            </div>
          )}

          {tab === "zombies" && (
            <div className="flex w-full flex-col items-center gap-4">
              <div className="text-[12px] font-bold tracking-[0.3em] text-zinc-500">
                KNOW YOUR ENEMY
              </div>
              <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
                {ZOMBIE_INFO.map((z) => (
                  <div
                    key={z.id}
                    className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3.5 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: z.tint, boxShadow: `0 0 8px ${z.tint}` }}
                      />
                      <span className="font-display text-lg tracking-wide text-zinc-100">{z.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 shrink-0 text-cyan-300/80" />
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={`h-1.5 w-3.5 rounded-full ${
                              n <= z.speedTier ? "bg-cyan-300/80" : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[13px] text-zinc-400">{z.speedLabel}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Swords className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400/80" />
                      <span className="text-[13px] text-zinc-400">{z.attackStyle}</span>
                    </div>
                    <div className="text-[13px] leading-relaxed text-zinc-600">{z.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center border-t border-white/10 p-4">
          <button
            onClick={onStart}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-11 py-3.5 text-base font-bold tracking-[0.22em] text-amber-950 shadow-[0_0_40px_rgba(245,158,11,0.35)] transition-all hover:scale-[1.03] active:scale-[0.98]"
          >
            <Play className="h-4 w-4" fill="currentColor" />
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassRow({
  cls, metaLevel, active, onPick,
}: { cls: WeaponClass; metaLevel: number; active: string | undefined; onPick: (id: string) => void }) {
  const ids = byClass(cls);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="text-[11px] font-bold tracking-[0.25em] text-zinc-600">{CLASS_LABEL[cls]}</div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {ids.map((wid) => {
          const w = WEAPONS[wid];
          const unlockLevel = WEAPON_UNLOCK_LEVEL[wid] ?? Infinity;
          const unlocked = metaLevel >= unlockLevel;
          const isActive = active === wid;
          return (
            <button
              key={wid}
              onClick={() => unlocked && onPick(wid)}
              disabled={!unlocked}
              title={unlocked ? w.desc : `unlocks at level ${unlockLevel}`}
              className={`flex w-32 flex-col items-center gap-1 rounded-lg border p-3 text-center transition ${
                isActive
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                  : unlocked
                    ? "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                    : "cursor-not-allowed border-white/5 bg-white/[0.01] text-zinc-700"
              }`}
            >
              {unlocked ? <Crosshair className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="text-[13px] font-bold leading-tight">{w.short}</span>
              {!unlocked && (
                <span className="flex items-center gap-1 text-[10px] tracking-wide text-zinc-600">
                  <Star className="h-2.5 w-2.5" /> LEVEL {unlockLevel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
      <div className="text-amber-300">{icon}</div>
      <div className="font-display text-xl text-zinc-100">{value}</div>
      <div className="text-[10px] font-bold tracking-[0.2em] text-zinc-500">{label}</div>
    </div>
  );
}
