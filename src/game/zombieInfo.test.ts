import { describe, it, expect } from "vitest";
import { ZOMBIE_INFO } from "./zombieInfo";

describe("ZOMBIE_INFO", () => {
  it("has one entry per zombie type, all unique", () => {
    const ids = ZOMBIE_INFO.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["brute", "runner", "screamer", "spitter", "walker"]);
  });

  it("every entry has non-empty display copy", () => {
    for (const z of ZOMBIE_INFO) {
      expect(z.name.length).toBeGreaterThan(0);
      expect(z.speedLabel.length).toBeGreaterThan(0);
      expect(z.attackStyle.length).toBeGreaterThan(0);
      expect(z.speedTier).toBeGreaterThanOrEqual(1);
      expect(z.speedTier).toBeLessThanOrEqual(5);
    }
  });
});
