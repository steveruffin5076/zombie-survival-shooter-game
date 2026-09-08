export interface HudState {
  hp: number;
  maxHp: number;
  xp: number;
  xpNext: number;
  level: number;
  wave: number;
  waveTotal: number;
  remaining: number;
  score: number;
  kills: number;
  high: number;
  dashT: number;
  dashMax: number;
  weapon: string;
  tier: number;
  tierMax: number;
  paused: boolean;
  muted: boolean;
  playing: boolean;
}

export type Rarity = "common" | "rare" | "epic";

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
  | { type: "pause"; value: boolean };
