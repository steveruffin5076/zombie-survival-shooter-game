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
  /** the stage's boss id, set only on the fixed-camera arena stage */
  bossId?: string;
  /** fixed-camera arena mode — prep phase, deployables, scrap */
  fixedCamera: boolean;
}

const WAVES_PER_STAGE = 9;
/** boss + finale-swarm waves on the arena stage */
const ARENA_BOSS_WAVES = [5, 9];

/** The endless cycle: 3 open stages, then a fixed-camera arena stage with a boss.
 * Cycles forever — same content, no ending. */
export const STAGES: StageDef[] = [
  {
    id: 1, name: "THE CEMETERY", sub: "where it all began",
    wavesPerStage: WAVES_PER_STAGE, bossWaves: [], worldW: 2880, themeId: "cemetery", fixedCamera: false,
  },
  {
    id: 2, name: "RUINED SUBURBS", sub: "nothing left to save",
    wavesPerStage: WAVES_PER_STAGE, bossWaves: [], worldW: 2880, themeId: "suburbs", fixedCamera: false,
  },
  {
    id: 3, name: "THE HIGHWAY", sub: "keep moving forward",
    wavesPerStage: WAVES_PER_STAGE, bossWaves: [], worldW: 2880, themeId: "highway", fixedCamera: false,
  },
  {
    id: 4, name: "GROUND ZERO", sub: "the end of the night",
    wavesPerStage: WAVES_PER_STAGE, bossWaves: ARENA_BOSS_WAVES, worldW: 1600, themeId: "arena",
    bossId: "juggernaut", fixedCamera: true,
  },
];

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
 * zombie hp/speed/dmg, boss hp...). Unbounded — endless has no ending to
 * balance toward. */
export function difficultyFor(stageNum: number, inStage: number): number {
  return cumulativeWaveIndex(stageNum, inStage);
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
