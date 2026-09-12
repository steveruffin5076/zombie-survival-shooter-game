import { describe, it, expect } from "vitest";
import { STAGES, stageDefFor, cumulativeWaveIndex, difficultyFor, rollEnemy } from "./stages";

describe("STAGES table", () => {
  it("has exactly 24 rows (6 acts × 4 stages)", () => {
    expect(STAGES).toHaveLength(24);
  });

  it("stages have sequential ids 1-24", () => {
    expect(STAGES.map((s) => s.id)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it("stages 4, 8, 12, 16, 20, 24 are fixedCamera Terminal Defense with boss", () => {
    const arenaIndices = [3, 7, 11, 15, 19, 23];
    for (const idx of arenaIndices) {
      expect(STAGES[idx].bossId).toBeTruthy();
      expect(STAGES[idx].indexInAct).toBe(3);
    }
  });

  it("stages 1-3, 5-7, 9-11, 13-15, 17-19, 21-23 are exploration (no boss)", () => {
    const explorationIndices = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22];
    for (const idx of explorationIndices) {
      expect(STAGES[idx].bossId).toBeUndefined();
      expect(STAGES[idx].indexInAct).toBeLessThan(3);
    }
  });

  it("each act has exactly 3 exploration stages (indexInAct 0-2)", () => {
    for (let actId = 1; actId <= 6; actId++) {
      const actStages = STAGES.filter((s) => s.actId === actId && s.indexInAct < 3);
      expect(actStages).toHaveLength(3);
    }
  });

  it("each act has exactly 1 Terminal Defense stage (indexInAct 3)", () => {
    for (let actId = 1; actId <= 6; actId++) {
      const defenseStages = STAGES.filter((s) => s.actId === actId && s.indexInAct === 3);
      expect(defenseStages).toHaveLength(1);
    }
  });
});

describe("stageDefFor", () => {
  it("wraps after 24 stages back to stage 1's theme", () => {
    expect(stageDefFor(25).name).toBe(stageDefFor(1).name);
    expect(stageDefFor(25).id).toBe(25);
  });

  it("cycles the table forever, never clamping", () => {
    expect(stageDefFor(50).name).toBe(stageDefFor(2).name);
    expect(stageDefFor(50).id).toBe(50);
  });
});

describe("cumulativeWaveIndex", () => {
  it("totals 240 across all 24 stages (24 stages × 10 waves)", () => {
    expect(cumulativeWaveIndex(24, 10)).toBe(240);
  });

  it("keeps growing unbounded past one cycle", () => {
    expect(cumulativeWaveIndex(30, 10)).toBeGreaterThan(240);
  });

  it("is monotonically increasing", () => {
    let prev = 0;
    for (let stage = 1; stage <= 30; stage++) {
      for (let wave = 1; wave <= 10; wave++) {
        const curr = cumulativeWaveIndex(stage, wave);
        expect(curr).toBeGreaterThanOrEqual(prev);
        prev = curr;
      }
    }
  });
});

describe("difficultyFor mission mode", () => {
  it("is monotonically non-decreasing", () => {
    let prev = 0;
    for (let stage = 1; stage <= 24; stage++) {
      for (let wave = 1; wave <= 10; wave++) {
        const d = difficultyFor(stage, wave, "mission");
        expect(d).toBeGreaterThanOrEqual(prev);
        prev = d;
      }
    }
  });

  it("reaches ~40 by Act VI stage 4 (wave 240)", () => {
    const final = difficultyFor(24, 10, "mission");
    expect(final).toBeLessThanOrEqual(40);
    expect(final).toBeGreaterThan(35);
  });

  it("starts low at Act I", () => {
    const first = difficultyFor(1, 1, "mission");
    expect(first).toBeLessThan(5);
  });

  it("caps at 40", () => {
    expect(difficultyFor(24, 10, "mission")).toBeLessThanOrEqual(40);
    expect(difficultyFor(50, 10, "mission")).toBeLessThanOrEqual(40);
  });
});

describe("difficultyFor endless mode", () => {
  it("climbs unbounded past 40", () => {
    const diff50 = difficultyFor(50, 5, "endless");
    expect(diff50).toBeGreaterThan(40);
  });

  it("matches cumulativeWaveIndex", () => {
    for (let stage = 1; stage <= 10; stage++) {
      for (let wave = 1; wave <= 10; wave++) {
        expect(difficultyFor(stage, wave, "endless")).toBe(cumulativeWaveIndex(stage, wave));
      }
    }
  });
});

describe("rollEnemy", () => {
  it("is deterministic under injected rng", () => {
    const weights = { walker: 1, runner: 1 };
    expect(rollEnemy(weights, () => 0)).toBe("walker");
    expect(rollEnemy(weights, () => 0.99)).toBe("runner");
  });

  it("ignores zero/undefined weights", () => {
    const weights = { walker: 1, runner: 0, splitter: undefined };
    const results = new Set();
    for (let i = 0; i < 50; i++) {
      results.add(rollEnemy(weights));
    }
    expect([...results]).toEqual(["walker"]);
  });
});
