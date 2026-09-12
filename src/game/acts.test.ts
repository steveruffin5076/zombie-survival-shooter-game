import { describe, it, expect } from "vitest";
import { ACTS } from "./acts";
import { STAGES } from "./stages";

describe("Acts", () => {
  it("has 6 acts", () => {
    expect(ACTS).toHaveLength(6);
  });

  it("each act has a unique id from 1-6", () => {
    const ids = ACTS.map((a) => a.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("each act has a valid boss id", () => {
    for (const act of ACTS) {
      expect(act.bossId).toBeTruthy();
    }
  });

  it("Act I has the screamer in its enemy pool", () => {
    const act1 = ACTS[0];
    expect(act1.enemyPool?.screamer).toBeGreaterThan(0);
  });

  it("Acts II-VI do not have screamer", () => {
    for (let i = 1; i < ACTS.length; i++) {
      const act = ACTS[i];
      expect(act.enemyPool?.screamer).toBeUndefined();
    }
  });

  it("produces 24 stages total (6 acts × 4 stages)", () => {
    expect(STAGES).toHaveLength(24);
  });

  it("each stage has a sequential id 1-24", () => {
    for (let i = 0; i < STAGES.length; i++) {
      expect(STAGES[i].id).toBe(i + 1);
    }
  });

  it("stages have correct act assignments", () => {
    for (let actIdx = 0; actIdx < ACTS.length; actIdx++) {
      for (let stageIdx = 0; stageIdx < 4; stageIdx++) {
        const stage = STAGES[actIdx * 4 + stageIdx];
        expect(stage.actId).toBe(ACTS[actIdx].id);
        expect(stage.indexInAct).toBe(stageIdx);
      }
    }
  });

  it("stages 1-3, 5-7, 9-11, 13-15, 17-19, 21-23 are exploration (not fixed camera)", () => {
    const explorationStages = [
      ...Array.from({ length: 3 }, (_, i) => i),
      ...Array.from({ length: 3 }, (_, i) => 4 + i),
      ...Array.from({ length: 3 }, (_, i) => 8 + i),
      ...Array.from({ length: 3 }, (_, i) => 12 + i),
      ...Array.from({ length: 3 }, (_, i) => 16 + i),
      ...Array.from({ length: 3 }, (_, i) => 20 + i),
    ];

    for (const idx of explorationStages) {
      expect(STAGES[idx].bossId).toBeUndefined();
    }
  });

  it("stages 4, 8, 12, 16, 20, 24 are Terminal Defense (the boss stages)", () => {
    const arenaStages = [3, 7, 11, 15, 19, 23];

    for (const idx of arenaStages) {
      expect(STAGES[idx].bossId).toBeTruthy();
      expect(STAGES[idx].indexInAct).toBe(3);
    }
  });
});
