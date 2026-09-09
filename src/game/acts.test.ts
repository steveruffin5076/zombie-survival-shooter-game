import { describe, it, expect } from "vitest";
import { ACTS, enemyPoolFor, rollEnemy } from "./acts";

describe("acts", () => {
  it("has exactly 6 acts, numbered I..VI", () => {
    expect(ACTS.length).toBe(6);
    expect(ACTS.map((a) => a.numeral)).toEqual(["I", "II", "III", "IV", "V", "VI"]);
    expect(ACTS.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("every act has exactly 4 stages, and only the 4th is fixedCamera", () => {
    for (const act of ACTS) {
      expect(act.stages.length).toBe(4);
      expect(act.stages.slice(0, 3).every((s) => !s.fixedCamera)).toBe(true);
      expect(act.stages[3].fixedCamera).toBe(true);
    }
  });

  it("every act declares a bossId", () => {
    for (const act of ACTS) expect(act.bossId.length).toBeGreaterThan(0);
  });

  it("Act I matches today's already-tuned 4 stages", () => {
    const act1 = ACTS[0];
    expect(act1.stages.map((s) => s.name)).toEqual([
      "THE CEMETERY", "RUINED SUBURBS", "THE HIGHWAY", "GROUND ZERO",
    ]);
    expect(act1.stages.map((s) => s.themeId)).toEqual(["cemetery", "suburbs", "highway", "arena"]);
    expect(act1.stages[3].worldW).toBe(1600);
  });
});

describe("enemyPoolFor", () => {
  it("only Act I has a Screamer weight; the rest have none", () => {
    expect(enemyPoolFor(1).screamer).toBeGreaterThan(0);
    for (const actId of [2, 3, 4, 5, 6]) expect(enemyPoolFor(actId).screamer).toBeUndefined();
  });

  it("returns {} for an out-of-range act id", () => {
    expect(enemyPoolFor(99)).toEqual({});
  });
});

describe("rollEnemy", () => {
  it("picks deterministically under an injected rng", () => {
    const weights = { walker: 1, runner: 1, brute: 2 };
    // total=4: [0,1)->walker [1,2)->runner [2,4)->brute
    expect(rollEnemy(weights, () => 0)).toBe("walker");
    expect(rollEnemy(weights, () => 0.26)).toBe("runner"); // 0.26*4=1.04
    expect(rollEnemy(weights, () => 0.99)).toBe("brute");
  });

  it("never picks a zero-or-unset-weight entry", () => {
    const weights = { walker: 1, runner: 0, spitter: 0, brute: 1 };
    for (let i = 0; i < 200; i++) {
      const pick = rollEnemy(weights, Math.random);
      expect(["walker", "brute"]).toContain(pick);
    }
  });

  it("folds an act's enemyPool into the base roster without disturbing it", () => {
    const base: Partial<Record<string, number>> = { walker: 1, runner: 0.5 };
    const weights = { ...base, ...enemyPoolFor(1) };
    expect(weights.screamer).toBeGreaterThan(0);
    expect(weights.walker).toBe(1);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rollEnemy(weights, Math.random));
    expect(seen).toEqual(new Set(["walker", "runner", "screamer"]));
  });
});
