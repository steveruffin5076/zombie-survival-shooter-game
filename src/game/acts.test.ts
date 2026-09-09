import { describe, it, expect } from "vitest";
import { ACTS } from "./acts";

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
