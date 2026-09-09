export type RunMode = "mission" | "endless";

export interface StageDef {
  id: number;
  name: string;
  sub: string;
  /** waves in this stage; the last one plus WAVES_PER_STAGE/2 is also a boss wave */
  wavesPerStage: number;
  /** in-stage wave numbers (1-based) that spawn a boss */
  bossWaves: number[];
  worldW: number;
  themeId: string;
}

const BASE_STAGES: Omit<StageDef, "id">[] = [
  { name: "THE CEMETERY", sub: "where it all began", wavesPerStage: 9, bossWaves: [5, 9], worldW: 2880, themeId: "cemetery" },
  { name: "RUINED SUBURBS", sub: "nothing left to save", wavesPerStage: 9, bossWaves: [5, 9], worldW: 2880, themeId: "suburbs" },
  { name: "THE HIGHWAY", sub: "keep moving forward", wavesPerStage: 9, bossWaves: [5, 9], worldW: 2880, themeId: "highway" },
  // fixed-camera arena — narrower than the free-roam stages on purpose
  { name: "GROUND ZERO", sub: "the end of the night", wavesPerStage: 9, bossWaves: [5, 9], worldW: 1600, themeId: "arena" },
];

/** The finite mission: 4 hand-authored stages, 36 waves total. */
export const STAGES: StageDef[] = BASE_STAGES.map((s, i) => ({ ...s, id: i + 1 }));

export const TOTAL_MISSION_WAVES = STAGES.reduce((sum, s) => sum + s.wavesPerStage, 0);

/**
 * Resolves the stage definition for a given 1-based stage number.
 * Mission mode clamps at the final stage (never loops back to Stage 1's
 * theme). Endless mode cycles the same table forever as a synthetic,
 * repeating stage — same content, no ending.
 */
export function stageDefFor(stageNum: number, mode: RunMode): StageDef {
  if (mode === "mission") {
    const id = Math.min(stageNum, STAGES.length);
    return STAGES[id - 1];
  }
  const i = (stageNum - 1) % STAGES.length;
  return { ...STAGES[i], id: stageNum };
}

/** Monotonic global wave count (1-based) at a given stage / in-stage-wave pair. */
export function cumulativeWaveIndex(stageNum: number, inStage: number, mode: RunMode): number {
  let sum = 0;
  for (let s = 1; s < stageNum; s++) sum += stageDefFor(s, mode).wavesPerStage;
  return sum + inStage;
}
