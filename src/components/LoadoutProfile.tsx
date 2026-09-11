import { useState } from "react";
import type { ProfileSnapshot } from "../game/types";
import { WEAPONS, CLASS_ORDER, CLASS_LABEL, byClass, type WeaponClass, type WeaponDef } from "../game/weapons";
import { WEAPON_UNLOCK_LEVEL } from "../game/progression";
import { ZOMBIE_INFO } from "../game/zombieInfo";
import {
  ATTACHMENT_ORDER, MAX_WEAPON_LEVEL, WEAPON_XP_PER_LEVEL, weaponLevelFor, unlockedAttachments,
  type AttachmentId,
} from "../game/attachments";
import {
  X, Play, Crosshair, Lock, Skull, Waves, Gem, Gauge, Swords,
  Wind, Target, Layers, ChevronLeft, Check, Infinity as InfinityIcon,
  Package, ChevronsRight, Zap, Wrench,
} from "lucide-react";

const CLASS_ICON: Record<WeaponClass, typeof Crosshair> = {
  pistol: Crosshair, smg: Wind, shotgun: Target, carbine: Layers,
};

const ATTACHMENT_ICON: Record<string, typeof Crosshair> = {
  Layers, Gauge, Package, ChevronsRight, Zap,
};

/** byClass() returns declaration order, not unlock order — every list of a
 * class's weapons reads left-to-right (or top-to-bottom) as a progression
 * the way the level number implies. */
function unlockSorted(cls: WeaponClass): string[] {
  return [...byClass(cls)].sort(
    (a, b) => (WEAPON_UNLOCK_LEVEL[a] ?? Infinity) - (WEAPON_UNLOCK_LEVEL[b] ?? Infinity)
  );
}

type Tab = "loadout" | "profile" | "zombies";
const TABS: Tab[] = ["loadout", "profile", "zombies"];

interface Props {
  profile: ProfileSnapshot;
  onClose: () => void;
  onStart: () => void;
  onSelectLoadout: (weaponId: string) => void;
  onEquipAttachment: (weaponId: string, attachmentId: AttachmentId | null) => void;
  /** button label + icon context — "START" before a run, "CONTINUE" between stages */
  ctaLabel?: string;
}

/** Opened from the Menu before an Endless run starts, and again between stages so
 * a level-up mid-run can actually be put to use — no more campaign, no walkable
 * hideout: just the weapon loadout (gated by lifetime meta level) and lifetime stats. */
export default function LoadoutProfile({ profile, onClose, onStart, onSelectLoadout, onEquipAttachment, ctaLabel = "START" }: Props) {
  const [tab, setTab] = useState<Tab>("loadout");
  const [selectedClass, setSelectedClass] = useState<WeaponClass | null>(null);
  const xpPct = Math.max(0, Math.min(1, profile.metaXp / profile.metaXpNext));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-[6px]">
      <div className="anim-pop relative flex h-[600px] w-full max-w-3xl flex-col rounded-xl border border-amber-500/20 bg-zinc-950/95 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
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
            selectedClass === null ? (
              <CategoryGrid profile={profile} onSelect={setSelectedClass} />
            ) : (
              <CategoryPage
                cls={selectedClass}
                profile={profile}
                onBack={() => setSelectedClass(null)}
                onSelectLoadout={onSelectLoadout}
                onEquipAttachment={onEquipAttachment}
              />
            )
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

/** Screen A — four large category cards; picking one opens CategoryPage for it. */
function CategoryGrid({
  profile, onSelect,
}: { profile: ProfileSnapshot; onSelect: (cls: WeaponClass) => void }) {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="text-[12px] font-bold tracking-[0.3em] text-zinc-500">
        CHOOSE A WEAPON CATEGORY
      </div>
      <div className="grid w-full grid-cols-2 gap-4 md:grid-cols-4">
        {CLASS_ORDER.map((cls) => {
          const ids = unlockSorted(cls);
          const unlockedCount = ids.filter((id) => profile.metaLevel >= (WEAPON_UNLOCK_LEVEL[id] ?? Infinity)).length;
          const equippedId = profile.equipped[cls];
          const Icon = CLASS_ICON[cls];
          const hasUnlocked = unlockedCount > 0;
          return (
            <button
              key={cls}
              onClick={() => onSelect(cls)}
              className={`flex flex-col items-center gap-2.5 rounded-xl border p-5 text-center transition hover:-translate-y-0.5 ${
                hasUnlocked
                  ? "border-amber-400/40 bg-amber-400/[0.06] hover:border-amber-400/60"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                  hasUnlocked ? "border-amber-400/40 bg-amber-400/15" : "border-white/12 bg-white/5"
                }`}
              >
                <Icon className={`h-5 w-5 ${hasUnlocked ? "text-amber-300" : "text-zinc-400"}`} />
              </div>
              <div className="font-display text-xl tracking-wide text-zinc-100">{CLASS_LABEL[cls]}</div>
              <div className="text-[11px] text-zinc-500">{unlockedCount} of {ids.length} unlocked</div>
              <div
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] ${
                  equippedId
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                    : "border-white/10 bg-white/5 text-zinc-500"
                }`}
              >
                {equippedId ? `EQUIPPED: ${WEAPONS[equippedId].short}` : "NONE UNLOCKED"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const classStat = (ids: string[], pick: (w: WeaponDef) => number) => {
  const vals = ids.map((id) => pick(WEAPONS[id]));
  return { min: Math.min(...vals), max: Math.max(...vals) };
};
const statPct = (val: number, min: number, max: number, invert = false) => {
  if (max <= min) return 100;
  const pct = ((val - min) / (max - min)) * 100;
  return invert ? 100 - pct : pct;
};

/** Screen B — a category's own page: every weapon in it on the left (locked
 * ones included, grayed out), the currently-previewed one's full stats on
 * the right. Clicking a row previews it; clicking an unlocked row also
 * equips it immediately, same as the old single-page picker. */
function CategoryPage({
  cls, profile, onBack, onSelectLoadout, onEquipAttachment,
}: {
  cls: WeaponClass; profile: ProfileSnapshot; onBack: () => void; onSelectLoadout: (id: string) => void;
  onEquipAttachment: (weaponId: string, attachmentId: AttachmentId | null) => void;
}) {
  const ids = unlockSorted(cls);
  const equippedId = profile.equipped[cls];
  const [previewId, setPreviewId] = useState(equippedId ?? ids[0]);
  const unlockedCount = ids.filter((id) => profile.metaLevel >= (WEAPON_UNLOCK_LEVEL[id] ?? Infinity)).length;

  const pick = (id: string) => {
    setPreviewId(id);
    const unlocked = profile.metaLevel >= (WEAPON_UNLOCK_LEVEL[id] ?? Infinity);
    if (unlocked) onSelectLoadout(id);
  };

  const w = WEAPONS[previewId];
  const previewUnlockLevel = WEAPON_UNLOCK_LEVEL[previewId] ?? Infinity;
  const previewLocked = profile.metaLevel < previewUnlockLevel;
  const dmg = classStat(ids, (x) => x.damage);
  const rpm = classStat(ids, (x) => x.rpm);
  const mag = classStat(ids, (x) => x.mag);
  const reload = classStat(ids, (x) => x.reload);
  const reserveIds = ids.filter((id) => WEAPONS[id].reserve >= 0);
  const reserve = reserveIds.length > 0 ? classStat(reserveIds, (x) => x.reserve) : { min: 0, max: 1 };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition hover:border-white/25 hover:text-white"
          aria-label="Back to categories"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-display text-2xl tracking-wide text-zinc-100">{CLASS_LABEL[cls]}</div>
        <div className="text-[11px] font-bold tracking-[0.2em] text-zinc-500">
          {unlockedCount} OF {ids.length} UNLOCKED
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto">
          {ids.map((wid) => {
            const wd = WEAPONS[wid];
            const unlockLevel = WEAPON_UNLOCK_LEVEL[wid] ?? Infinity;
            const locked = profile.metaLevel < unlockLevel;
            const isEquipped = equippedId === wid;
            const isPreviewed = previewId === wid;
            return (
              <button
                key={wid}
                onClick={() => pick(wid)}
                className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition ${
                  isPreviewed
                    ? "border-amber-400/60 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                    : locked
                      ? "border-white/5 bg-white/[0.01] opacity-55 hover:border-white/15"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <div>
                  <div className={`text-sm font-bold ${isPreviewed ? "text-amber-300" : locked ? "text-zinc-500" : "text-zinc-200"}`}>
                    {wd.name}
                  </div>
                  {isEquipped ? (
                    <div className="mt-0.5 text-[10px] tracking-[0.1em] text-amber-400/70">EQUIPPED</div>
                  ) : locked ? (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] tracking-[0.1em] text-zinc-600">
                      <Lock className="h-2.5 w-2.5" /> LEVEL {unlockLevel}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] tracking-[0.1em] text-zinc-600">OWNED</div>
                  )}
                </div>
                {isEquipped && <Check className="h-4 w-4 shrink-0 text-amber-400" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto rounded-xl border border-white/10 bg-white/[0.015] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-xl tracking-wide text-zinc-100">{w.name}</div>
              <div className="mt-1 max-w-sm text-[13px] leading-relaxed text-zinc-500">{w.desc}</div>
            </div>
            {previewUnlockLevel === 1 ? (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-gradient-to-b from-amber-400 to-amber-600 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-amber-950">
                STARTER
              </span>
            ) : previewLocked ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-zinc-400">
                <Lock className="h-2.5 w-2.5" /> LEVEL {previewUnlockLevel}
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-3.5">
            <StatBar label="DAMAGE" value={String(w.damage)} pct={statPct(w.damage, dmg.min, dmg.max)} />
            <StatBar label="FIRE RATE" value={`${w.rpm} RPM`} pct={statPct(w.rpm, rpm.min, rpm.max)} />
            <StatBar label="MAG SIZE" value={String(w.mag)} pct={statPct(w.mag, mag.min, mag.max)} />
            <StatBar label="RELOAD SPEED" value={`${w.reload.toFixed(2)}s`} pct={statPct(w.reload, reload.min, reload.max, true)} />
            {w.reserve < 0 ? (
              <StatBar label="RESERVE AMMO" value="UNLIMITED" pct={100} icon={<InfinityIcon className="h-3 w-3" />} cyan />
            ) : (
              <StatBar label="RESERVE AMMO" value={String(w.reserve)} pct={statPct(w.reserve, reserve.min, reserve.max)} cyan />
            )}
          </div>

          {!previewLocked && (
            <MasterySection
              weaponId={previewId}
              xp={profile.weaponXp[previewId] ?? 0}
              equippedAttachment={(profile.equippedAttachment[previewId] as AttachmentId | null) ?? null}
              onEquipAttachment={onEquipAttachment}
            />
          )}

          <div className="mt-auto pt-4 text-[10px] text-zinc-600">
            Bars are shown relative to the other weapons in this class.
          </div>
        </div>
      </div>
    </div>
  );
}

/** Per-weapon mastery: kills with this exact weapon build XP toward its own
 * attachment unlocks (see attachments.ts) — a third progression axis, separate
 * from in-run level-ups and lifetime account level. One slot, swap anytime. */
function MasterySection({
  weaponId, xp, equippedAttachment, onEquipAttachment,
}: {
  weaponId: string; xp: number; equippedAttachment: AttachmentId | null;
  onEquipAttachment: (weaponId: string, attachmentId: AttachmentId | null) => void;
}) {
  const level = weaponLevelFor(xp);
  const maxed = level >= MAX_WEAPON_LEVEL;
  const intoLevel = xp - level * WEAPON_XP_PER_LEVEL;
  const pct = maxed ? 100 : (intoLevel / WEAPON_XP_PER_LEVEL) * 100;
  const unlocked = unlockedAttachments(xp);

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-[0.1em] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Wrench className="h-3 w-3" /> WEAPON MASTERY
        </span>
        <span className="text-zinc-200">{maxed ? "MAX" : `LEVEL ${level} / ${MAX_WEAPON_LEVEL}`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-300"
          style={{ width: `${Math.max(maxed ? 100 : 4, pct)}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-zinc-600">
        {maxed ? "All attachments unlocked for this weapon." : "Kill zombies with this weapon equipped to level it up."}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ATTACHMENT_ORDER.map((a) => {
          const isUnlocked = unlocked.some((u) => u.id === a.id);
          const isEquipped = equippedAttachment === a.id;
          const Icon = ATTACHMENT_ICON[a.icon] ?? Package;
          const reqLevel = ATTACHMENT_ORDER.indexOf(a) + 1;
          return (
            <button
              key={a.id}
              disabled={!isUnlocked}
              onClick={() => onEquipAttachment(weaponId, isEquipped ? null : a.id)}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition ${
                isEquipped
                  ? "border-cyan-400/60 bg-cyan-400/10"
                  : isUnlocked
                    ? "border-white/10 bg-white/[0.02] hover:border-white/25"
                    : "cursor-not-allowed border-white/5 bg-white/[0.01] opacity-50"
              }`}
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isEquipped ? "text-cyan-300" : "text-zinc-400"}`} />
              <div className="min-w-0">
                <div className={`text-[12px] font-bold ${isEquipped ? "text-cyan-300" : isUnlocked ? "text-zinc-200" : "text-zinc-500"}`}>
                  {a.name}
                </div>
                <div className="text-[10px] leading-snug text-zinc-600">{a.desc}</div>
                {!isUnlocked && (
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] tracking-[0.1em] text-zinc-600">
                    <Lock className="h-2.5 w-2.5" /> WEAPON LEVEL {reqLevel}
                  </div>
                )}
              </div>
              {isEquipped && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-cyan-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatBar({
  label, value, pct, cyan, icon,
}: { label: string; value: string; pct: number; cyan?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold tracking-[0.1em] text-zinc-500">
        <span>{label}</span>
        <span className="flex items-center gap-1 text-zinc-200">{icon}{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${cyan ? "from-cyan-600 to-cyan-300" : "from-amber-600 to-amber-300"}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
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
