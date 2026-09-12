export interface StageDef {
  id: number;
  name: string;
  sub: string;
  /** waves in this stage; the last one plus WAVES_PER_STAGE/2 is also a boss wave */
  wavesPerStage: number;
  /** in-stage wave numbers (1-based) that get boss-tier treatment (HUD pips,
   *  buildWave's finale-swarm stacking); empty on non-boss stages */
  bossWaves: number[];
  worldW: number;
  themeId: string;
  /** the stage's boss id — set only on the Terminal Defense stage, and the one
   * flag that marks it: it also gates the 10s opening countdown and the
   * between-wave resupply */
  bossId?: string;
  /** act this stage belongs to (1-6) */
  actId: number;
  /** 0-3: which stage within the act (0-2 exploration, 3 Terminal Defense) */
  indexInAct: number;
}

import { ACTS } from "./acts";

/** boss waves on the arena stage: wave 5 (small boss), wave 10 (big boss) */
const ARENA_BOSS_WAVES = [5, 10];

/** 24-stage campaign: 6 acts × (3 exploration + 1 Terminal Defense).
 * Derived from ACTS; cycles forever after reaching the end. */
export const STAGES: StageDef[] = ACTS.flatMap((act, actIndex) => [
  // 3 exploration stages per act
  {
    id: actIndex * 4 + 1,
    name: act.name,
    sub: act.sub,
    wavesPerStage: act.explorationWaves,
    bossWaves: [],
    worldW: act.worldW,
    themeId: act.themeId,
    actId: act.id,
    indexInAct: 0,
  },
  {
    id: actIndex * 4 + 2,
    name: act.name,
    sub: act.sub,
    wavesPerStage: act.explorationWaves,
    bossWaves: [],
    worldW: act.worldW,
    themeId: act.themeId,
    actId: act.id,
    indexInAct: 1,
  },
  {
    id: actIndex * 4 + 3,
    name: act.name,
    sub: act.sub,
    wavesPerStage: act.explorationWaves,
    bossWaves: [],
    worldW: act.worldW,
    themeId: act.themeId,
    actId: act.id,
    indexInAct: 2,
  },
  // Terminal Defense stage (arena with boss)
  {
    id: actIndex * 4 + 4,
    name: act.name,
    sub: "terminal defense",
    wavesPerStage: act.defenseWaves,
    bossWaves: ARENA_BOSS_WAVES,
    worldW: 1600,
    themeId: act.arenaThemeId,
    bossId: act.bossId,
    actId: act.id,
    indexInAct: 3,
  },
]);

/** Resolves the stage definition for a given 1-based stage number — cycles
 * the table forever as a synthetic, repeating stage. */
export function stageDefFor(stageNum: number): StageDef {
  const i = (stageNum - 1) % STAGES.length;
  return { ...STAGES[i], id: stageNum };
}

/** Monotonic global wave count (1-based) at a given stage / in-stage-wave pair. */
export function cumulativeWaveIndex(stageNum: number, inStage: number): number {
  let sum = 0;
  for (let s = 1; s < stageNum; s++) sum += stageDefFor(s).wavesPerStage;
  return sum + inStage;
}

/** The difficulty scalar every combat-balance formula reads (spawn count,
 * zombie hp/speed/dmg, boss hp...). Mission mode caps at ~40 by Act VI;
 * endless keeps its unbounded ramp. */
export function difficultyFor(stageNum: number, inStage: number, mode: "mission" | "endless" = "mission"): number {
  if (mode === "endless") return cumulativeWaveIndex(stageNum, inStage);

  // Linear curve: difficulty = waveIndex / 6, capping at 40 at the final wave (240 total)
  // This means: Act I stage 1 ≈ 1.7, Act VI stage 4 ≈ 40
  const waveIndex = cumulativeWaveIndex(stageNum, inStage);
  return Math.min(waveIndex / 6, 40);
}

/**
 * Weighted pick across a spawn-weight table, keyed by ZType id (kept as a
 * plain string here — stages.ts doesn't depend on engine.ts's private types).
 * `rng` is injected so this is deterministic under test, same pattern as
 * `rollLoot` in loot.ts.
 */
export function rollEnemy(weights: Partial<Record<string, number>>, rng: () => number = Math.random): string {
  const entries = Object.entries(weights).filter((e): e is [string, number] => (e[1] ?? 0) > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [type, w] of entries) {
    roll -= w;
    if (roll < 0) return type;
  }
  return entries[entries.length - 1][0];
}
