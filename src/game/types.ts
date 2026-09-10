import type { DeployableKind } from "./arena";
import type { BossAttack } from "./boss";

export interface WeaponSlot {
  /** weapon class this slot represents */
  cls: string;
  label: string;
  /** short name of the equipped variant in this class */
  short: string;
  owned: boolean;
  active: boolean;
  key: string;
  ammo: number;
  mag: number;
  /** how many variants of this class the player owns */
  variants: number;
}

export interface HudState {
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  level: number;
  stage: number;
  stageName: string;
  /** which act this stage belongs to — used to pick the Hideout board's document set */
  actId: number;
  waveInStage: number;
  wavesPerStage: number;
  /** in-stage wave numbers (1-based) that spawn a boss */
  bossWaves: number[];
  isBossWave: boolean;
  remaining: number;
  waveTotal: number;
  phase: "break" | "active" | "travel" | "prep" | "building";
  /** campaign only — the building's current floor and total, while phase === "building" */
  floor: number;
  floorCount: number;
  /** 0..1 progress from where travel started to the safe house door */
  travelDistance: number;
  travelGatesTotal: number;
  travelGatesOpened: number;
  score: number;
  kills: number;
  high: number;
  dashT: number;
  dashMax: number;
  weapon: string;
  weaponRole: string;
  weapons: WeaponSlot[];
  ammo: number;
  mag: number;
  /** spare rounds; -1 means unlimited (pistols) */
  reserve: number;
  reloading: boolean;
  /** 0..1 reload progress */
  reloadPct: number;
  /** true = auto engage, false = manual trigger */
  autoFire: boolean;
  /** 0..1 noise/threat build-up */
  threat: number;
  /** remaining suppressor shots */
  supp: number;
  suppMax: number;
  suppBroken: boolean;
  /** which lane the player is locked to */
  facing: 1 | -1;
  /** a target is currently on the laser line */
  onTarget: boolean;
  range: number;
  paused: boolean;
  muted: boolean;
  playing: boolean;
  /** in the Hideout, close enough to the terminal to interact */
  terminalNear: boolean;
  /** campaign run — no XP/leveling, so the HUD hides that bar entirely */
  campaignMode: boolean;
  /** simple scalar crate feedback — bulk grid contents go through getInventory(), not here */
  crateNear: boolean;
  crateTier: 0 | 1 | 2 | 3;
  /** 0..1 hold-to-open progress */
  crateOpenPct: number;
  /** tier 2/3 crate refusing to open because threat is too high */
  crateLocked: boolean;
  /** an unopened gate is in quiet-bypass range (hold E) */
  gateBypassNear: boolean;
  /** 0..1 hold-to-bypass progress */
  gateBypassPct: number;
  /** a bypassable gate is in range but threat is too high to use it */
  gateBypassLocked: boolean;
  /** stage 4 only — gates the prep/deployables/scrap UI */
  arena: boolean;
  /** seconds left in the arena's prep phase */
  prepT: number;
  prepMax: number;
  /** deployable tool currently selected for placement, if any */
  placingKind: DeployableKind | null;
  scrap: number;
  /** seconds left in the per-prep repair window — RepairPanel shows while > 0 */
  repairWindowT: number;
  repairWindowMax: number;
  /** a Terminal Defense boss is alive — gates the 3-segment boss bar */
  bossActive: boolean;
  /** display name for the boss bar — data-driven per BOSS_DEFS, null when no boss is active */
  bossName: string | null;
  bossHp: number;
  bossHpMax: number;
  bossPhase: 0 | 1 | 2;
  /** the attack currently telegraphing, if the boss is mid-windup */
  bossAttack: BossAttack | null;
  /** 0..1 windup progress toward that attack landing */
  bossWindupPct: number;
  /** KeyE toggle — forces auto-aim onto the boss over a close add */
  bossForceTarget: boolean;
}

export type Rarity = "common" | "rare" | "epic" | "weapon";

export interface UpgradeChoice {
  id: string;
  name: string;
  desc: string;
  icon: string;
  stacks: number;
  max: number;
  rarity: Rarity;
}

export interface GameStats {
  stage: number;
  wave: number;
  kills: number;
  level: number;
  score: number;
  time: number;
  best: number;
  isBest: boolean;
}

export interface MissionStats {
  score: number;
  kills: number;
  level: number;
  time: number;
  bestTime: number;
  isBestTime: boolean;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
}

/**
 * Polled through Engine.getInventory(), never folded into HudState — the
 * backpack/deposit arrays are bulkier and change far less often than the
 * 66ms combat HUD poll, so the UI gates re-renders on `invVer` instead.
 */
export interface InventorySnapshot {
  invVer: number;
  backpack: InventoryItem[];
  deposit: string[];
  intel: number;
  /** ids of intel documents found so far — the Hideout board looks these up in INTEL_DOCS */
  docs: string[];
  backpackSize: { w: number; h: number };
}

export type EngineEvent =
  | { type: "levelup"; choices: UpgradeChoice[] }
  | { type: "resume" }
  | { type: "gameover"; stats: GameStats }
  | { type: "stageclear"; stage: number; next: number; wavesPerStage: number }
  | { type: "missionwin"; stats: MissionStats }
  | { type: "pause"; value: boolean };
