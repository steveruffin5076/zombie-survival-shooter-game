import type { PlacedItem } from "./grid";
import type { RunMode } from "./stages";
import type { WeaponClass } from "./weapons";

export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
  runMode: RunMode;
  /** the stage the player respawns into — always the start of its break phase */
  stage: number;
  level: number;
  xp: number;
  xpNext: number;
  score: number;
  kills: number;
  playTime: number;
  owned: string[];
  equipped: Partial<Record<WeaponClass, string>>;
  kind: string;
  stacks: Record<string, number>;
  /** persistent stash (item ids, unordered) — survives death, unlike the carried backpack */
  deposit: string[];
  backpack: PlacedItem[];
  intel: number;
  /** Hideout board — ids of intel documents found so far. */
  hideout: { docs: string[] } | null;
}

const keyFor = (mode: RunMode) => `graveyard-shift-save-${mode}`;

/** Migrates an older/malformed save forward. Returns null if it's unsalvageable. */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<SaveData>;
  if (typeof d.version !== "number" || d.version > SAVE_VERSION) return null;
  // v1 saves always wrote `hideout: null` (the field was stubbed, never read) —
  // v2 gives it real shape. Anything else malformed just resets to empty.
  const hideoutDocs = (d.hideout as { docs?: unknown } | null)?.docs;
  const hideout = { docs: Array.isArray(hideoutDocs) ? hideoutDocs.filter((x) => typeof x === "string") : [] };
  if (
    typeof d.stage !== "number" || typeof d.level !== "number" ||
    !Array.isArray(d.owned) || !Array.isArray(d.deposit) || !Array.isArray(d.backpack)
  ) return null;
  return {
    version: SAVE_VERSION,
    runMode: d.runMode === "mission" ? "mission" : "endless",
    stage: d.stage,
    level: d.level,
    xp: d.xp ?? 0,
    xpNext: d.xpNext ?? 12,
    score: d.score ?? 0,
    kills: d.kills ?? 0,
    playTime: d.playTime ?? 0,
    owned: d.owned,
    equipped: d.equipped ?? {},
    kind: d.kind ?? "p365",
    stacks: d.stacks ?? {},
    deposit: d.deposit,
    backpack: d.backpack,
    intel: d.intel ?? 0,
    hideout,
  };
}

export function saveRun(data: SaveData): void {
  try {
    localStorage.setItem(keyFor(data.runMode), JSON.stringify(data));
  } catch {
    // storage full/unavailable — a lost checkpoint isn't worth crashing the run over
  }
}

export function loadRun(mode: RunMode): SaveData | null {
  try {
    const raw = localStorage.getItem(keyFor(mode));
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearRun(mode: RunMode): void {
  try {
    localStorage.removeItem(keyFor(mode));
  } catch {
    // nothing to do — no save, no problem
  }
}
