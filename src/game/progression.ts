import { WEAPON_IDS, STARTER } from "./weapons";

/**
 * Persistent account progression — separate from a single run's in-run HP/dash
 * upgrade picks. Meta level is earned across every run (kills, waves survived,
 * scrap collected) and never resets; it's what permanently unlocks weapons in
 * the Loadout screen, shown on the Profile tab.
 */

/** Meta level each non-starter weapon unlocks at. STARTER (p365) is free from level 1.
 * Ordering rotates across classes so a new gun lands roughly every level, cheaper/
 * simpler weapons first, the two strongest pistols saved for last. */
export const WEAPON_UNLOCK_LEVEL: Record<string, number> = {
  p365: 1,
  bizon: 2,
  aa12: 3,
  hk416: 4,
  glock18: 5,
  p90: 6,
  origin12: 7,
  m4a1: 8,
  tec9: 9,
  mp5: 10,
  spas12: 11,
  g36c: 12,
  vector: 13,
  benelli: 14,
  asval: 15,
  ump45: 16,
  w1200: 17,
  aks74u: 18,
  m1911: 19,
  deagle: 20,
};

/** Highest meta level with a weapon unlock attached to it — beyond this, leveling
 * up is purely a Profile bragging stat, nothing left to earn. */
export const MAX_UNLOCK_LEVEL = Math.max(...Object.values(WEAPON_UNLOCK_LEVEL));

/** XP needed to go from `level` to `level + 1`. */
export function metaXpFor(level: number): number {
  return Math.round(40 + (level - 1) * 25);
}

/** Every weapon id owned at a given meta level. */
export function ownedWeaponsForLevel(level: number): string[] {
  return WEAPON_IDS.filter((id) => (WEAPON_UNLOCK_LEVEL[id] ?? Infinity) <= level);
}

export function isWeaponUnlocked(id: string, level: number): boolean {
  return (WEAPON_UNLOCK_LEVEL[id] ?? Infinity) <= level;
}

/** Fresh account: only the starter pistol. */
export const DEFAULT_EQUIPPED = { pistol: STARTER };
