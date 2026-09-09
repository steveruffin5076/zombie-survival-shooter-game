import { ACTS, type ActDef } from "./acts";

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
  /** which act this stage belongs to (1-based) */
  actId: number;
  /** this stage's position within its act — 3 is always the Terminal Defense */
  indexInAct: 0 | 1 | 2 | 3;
  /** the act's unique boss id, set only on the Terminal Defense stage. Not yet
   *  consumed by spawnBoss() — see Phase 9 in docs/progress.md */
  bossId?: string;
  /** fixed-camera arena mode — replaces the old `themeId === "arena"` gate */
  fixedCamera: boolean;
}

const WAVES_PER_STAGE = 9;
const BOSS_WAVES = [5, 9];

function stagesForAct(act: ActDef): Omit<StageDef, "id">[] {
  return act.stages.map((s, i) => ({
    name: s.name,
    sub: s.sub,
    wavesPerStage: WAVES_PER_STAGE,
    bossWaves: BOSS_WAVES,
    worldW: s.worldW,
    themeId: s.themeId,
    actId: act.id,
    indexInAct: i as 0 | 1 | 2 | 3,
    bossId: s.fixedCamera ? act.bossId : undefined,
    fixedCamera: !!s.fixedCamera,
  }));
}

/** The finite mission: 6 acts x 4 hand-authored stages = 24 stages total. */
export const STAGES: StageDef[] = ACTS.flatMap(stagesForAct).map((s, i) => ({ ...s, id: i + 1 }));

export const TOTAL_MISSION_WAVES = STAGES.reduce((sum, s) => sum + s.wavesPerStage, 0);

/** Total waves across Act I alone — today's already-tuned content, unchanged. */
const ACT_I_WAVES = STAGES.filter((s) => s.actId === 1).reduce((sum, s) => sum + s.wavesPerStage, 0);

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

/**
 * The difficulty scalar every combat-balance formula reads (spawn count,
 * zombie hp/speed/dmg, boss hp...). Decoupled from `cumulativeWaveIndex`
 * because a 24-stage mission would otherwise drive it to 216 — 48x zombie hp,
 * a ~41,400hp boss, 16x player-facing damage (see docs/progress.md's Phase 8
 * writeup for the exact formulas). Identical to `cumulativeWaveIndex` through
 * Act I's 36 waves — today's already-tuned, already-verified content is
 * byte-for-byte unchanged — then grows far more slowly for Acts II-VI so the
 * mission stays winnable at 24 stages. Endless mode is left unbounded on
 * purpose: it already has no ending to balance toward.
 */
export function difficultyFor(stageNum: number, inStage: number, mode: RunMode): number {
  const idx = cumulativeWaveIndex(stageNum, inStage, mode);
  if (mode === "endless") return idx;
  if (idx <= ACT_I_WAVES) return idx;
  return ACT_I_WAVES + (idx - ACT_I_WAVES) * 0.03;
}
