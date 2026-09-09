import { describe, it, expect } from "vitest";
import { STAGES, stageDefFor, cumulativeWaveIndex, difficultyFor } from "./stages";

describe("STAGES table", () => {
  it("has exactly 24 rows (6 acts x 4 stages), sequentially 1-based ids", () => {
    expect(STAGES.length).toBe(24);
    expect(STAGES.map((s) => s.id)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it("every 4th stage (Terminal Defense) is fixedCamera with a bossId; the rest aren't", () => {
    STAGES.forEach((s, i) => {
      const isDefense = i % 4 === 3;
      expect(s.fixedCamera).toBe(isDefense);
      expect(!!s.bossId).toBe(isDefense);
    });
  });

  it("actId/indexInAct partition the table correctly", () => {
    for (let a = 0; a < 6; a++) {
      const rows = STAGES.slice(a * 4, a * 4 + 4);
      expect(rows.every((s) => s.actId === a + 1)).toBe(true);
      expect(rows.map((s) => s.indexInAct)).toEqual([0, 1, 2, 3]);
    }
  });
});

describe("stageDefFor", () => {
  it("mission mode clamps at stage 24, never wraps", () => {
    expect(stageDefFor(24, "mission").name).toBe(stageDefFor(30, "mission").name);
    expect(stageDefFor(30, "mission").name).toBe("SECTOR VI-4");
  });

  it("endless mode wraps every 24 stages back to Act I stage 1", () => {
    expect(stageDefFor(25, "endless").name).toBe("THE CEMETERY");
    expect(stageDefFor(25, "endless").actId).toBe(1);
    expect(stageDefFor(25, "endless").id).toBe(25);
  });
});

describe("cumulativeWaveIndex", () => {
  it("totals 216 across the full 24-stage mission (24 stages x 9 waves)", () => {
    expect(cumulativeWaveIndex(24, 9, "mission")).toBe(216);
  });

  it("still grows unbounded in endless mode past the mission's stage count", () => {
    expect(cumulativeWaveIndex(30, 9, "endless")).toBeGreaterThan(216);
  });
});

describe("difficultyFor", () => {
  it("is monotonically non-decreasing across the whole mission", () => {
    let prev = 0;
    for (let stage = 1; stage <= 24; stage++) {
      for (let wave = 1; wave <= 9; wave++) {
        const d = difficultyFor(stage, wave, "mission");
        expect(d).toBeGreaterThanOrEqual(prev);
        prev = d;
      }
    }
  });

  it("is identical to cumulativeWaveIndex through Act I (today's tuned content, unchanged)", () => {
    for (let stage = 1; stage <= 4; stage++) {
      for (let wave = 1; wave <= 9; wave++) {
        expect(difficultyFor(stage, wave, "mission")).toBe(cumulativeWaveIndex(stage, wave, "mission"));
      }
    }
    // the exact number Phase 6's boss balance was tuned and verified against
    expect(difficultyFor(1, 5, "mission")).toBe(5);
  });

  it("caps well below the raw 216 by the end of the 24-stage mission", () => {
    expect(difficultyFor(24, 9, "mission")).toBeLessThan(50);
  });

  it("endless mode climbs past the mission's difficulty cap", () => {
    const missionCap = difficultyFor(24, 9, "mission");
    expect(difficultyFor(40, 9, "endless")).toBeGreaterThan(missionCap);
  });
});
