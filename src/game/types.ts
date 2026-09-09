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
  waveInStage: number;
  wavesPerStage: number;
  isBossWave: boolean;
  remaining: number;
  waveTotal: number;
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

export type EngineEvent =
  | { type: "levelup"; choices: UpgradeChoice[] }
  | { type: "resume" }
  | { type: "gameover"; stats: GameStats }
  | { type: "stageclear"; stage: number; next: number }
  | { type: "pause"; value: boolean };
