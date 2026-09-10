import { describe, it, expect } from "vitest";
import { STAGES, stageDefFor, cumulativeWaveIndex, difficultyFor, rollEnemy } from "./stages";

describe("STAGES table", () => {
  it("has exactly 4 rows, sequentially 1-based ids", () => {
    expect(STAGES.length).toBe(4);
    expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  });

  it("only the 4th stage (the arena) is fixedCamera with a bossId; the rest aren't", () => {
    STAGES.forEach((s, i) => {
      const isArena = i === 3;
      expect(s.fixedCamera).toBe(isArena);
      expect(!!s.bossId).toBe(isArena);
    });
  });
});

describe("stageDefFor", () => {
  it("wraps every 4 stages back to stage 1's theme", () => {
    expect(stageDefFor(5).name).toBe("THE CEMETERY");
    expect(stageDefFor(5).id).toBe(5);
  });

  it("cycles the table forever, never clamping", () => {
    expect(stageDefFor(41).name).toBe(stageDefFor(1).name);
  });
});

describe("cumulativeWaveIndex", () => {
  it("totals 40 across the first 4-stage cycle (4 stages x 10 waves)", () => {
    expect(cumulativeWaveIndex(4, 10)).toBe(40);
  });

  it("keeps growing unbounded past one cycle", () => {
    expect(cumulativeWaveIndex(30, 10)).toBeGreaterThan(40);
  });
});

describe("difficultyFor", () => {
  it("is monotonically non-decreasing", () => {
    let prev = 0;
    for (let stage = 1; stage <= 8; stage++) {
      for (let wave = 1; wave <= 10; wave++) {
        const d = difficultyFor(stage, wave);
        expect(d).toBeGreaterThanOrEqual(prev);
        prev = d;
      }
    }
  });

  it("is identical to cumulativeWaveIndex (unbounded — endless has no ending to balance toward)", () => {
    for (let stage = 1; stage <= 4; stage++) {
      for (let wave = 1; wave <= 10; wave++) {
        expect(difficultyFor(stage, wave)).toBe(cumulativeWaveIndex(stage, wave));
      }
    }
    expect(difficultyFor(1, 5)).toBe(5);
  });
});

describe("rollEnemy", () => {
  it("is deterministic under an injected rng", () => {
    const weights = { walker: 1, runner: 1 };
    expect(rollEnemy(weights, () => 0)).toBe("walker");
    expect(rollEnemy(weights, () => 0.99)).toBe("runner");
  });

  it("ignores zero/negative-weight entries", () => {
    expect(rollEnemy({ walker: 1, runner: 0 }, () => 0.99)).toBe("walker");
  });
});
