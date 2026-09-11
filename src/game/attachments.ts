import type { WeaponDef } from "./weapons";

export type AttachmentId = "extended_mag" | "rapid_reload" | "extended_reserve" | "long_barrel" | "fast_swap";

export interface AttachmentDef {
  id: AttachmentId;
  name: string;
  short: string;
  desc: string;
  icon: string;
}

/** Fixed unlock order — weapon level N unlocks ATTACHMENT_ORDER[N-1]. Same 5
 * for every weapon (universal), deliberately picked to never overlap a
 * run-upgrade's stat: mag/reload/reserve/range/swap-speed are stats no
 * upgrade in upgrades.ts touches at all — those own damage/rate/crit/pierce/
 * velocity/HP/speed/lifesteal/regen/dash instead. Two systems, two axes. */
export const ATTACHMENT_ORDER: AttachmentDef[] = [
  { id: "extended_mag", name: "Extended Mag", short: "EXT MAG", desc: "+40% magazine size.", icon: "Layers" },
  { id: "rapid_reload", name: "Rapid Reload", short: "RAPID RELOAD", desc: "-30% reload time.", icon: "Gauge" },
  {
    id: "extended_reserve", name: "Extended Reserve", short: "EXT RESERVE",
    desc: "+30% max spare ammo. No effect on unlimited-reserve pistols.", icon: "Package",
  },
  { id: "long_barrel", name: "Long Barrel", short: "LONG BARREL", desc: "+20% effective range.", icon: "ChevronsRight" },
  { id: "fast_swap", name: "Fast Swap", short: "FAST SWAP", desc: "-40% weapon-switch time.", icon: "Zap" },
];

const ATTACHMENT_BY_ID: Record<AttachmentId, AttachmentDef> = Object.fromEntries(
  ATTACHMENT_ORDER.map((a) => [a.id, a])
) as Record<AttachmentId, AttachmentDef>;

export function attachmentDef(id: AttachmentId): AttachmentDef {
  return ATTACHMENT_BY_ID[id];
}

/** Flat kills-per-level, deliberately fast — every weapon you actually use
 * masters out within a session or two, rather than a long multi-run grind. */
export const WEAPON_XP_PER_LEVEL = 40;
export const MAX_WEAPON_LEVEL = ATTACHMENT_ORDER.length;

export function weaponLevelFor(xp: number): number {
  return Math.max(0, Math.min(MAX_WEAPON_LEVEL, Math.floor(xp / WEAPON_XP_PER_LEVEL)));
}

export function unlockedAttachments(xp: number): AttachmentDef[] {
  return ATTACHMENT_ORDER.slice(0, weaponLevelFor(xp));
}

/** Applies the equipped attachment's modifiers on top of a weapon's base
 * stats. Returns a new object — never mutates WEAPONS[id]. */
export function applyAttachment(base: WeaponDef, attachmentId: AttachmentId | null | undefined): WeaponDef {
  if (!attachmentId) return base;
  switch (attachmentId) {
    case "extended_mag":
      return { ...base, mag: Math.round(base.mag * 1.4) };
    case "rapid_reload":
      return { ...base, reload: base.reload * 0.7 };
    case "extended_reserve":
      return base.reserve < 0 ? base : { ...base, reserve: Math.round(base.reserve * 1.3) };
    case "long_barrel":
      return { ...base, range: base.range * 1.2 };
    case "fast_swap":
      return { ...base, swap: base.swap * 0.6 };
    default:
      return base;
  }
}
