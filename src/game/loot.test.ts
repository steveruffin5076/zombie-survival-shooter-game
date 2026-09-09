import { describe, expect, it } from "vitest";
import { rollLoot } from "./loot";
import { itemExists } from "./loot";

/** A deterministic PRNG (mulberry32) so loot rolls are reproducible in tests. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("rollLoot", () => {
  it("only ever returns known item ids", () => {
    const rng = seeded(1);
    for (let tier = 1; tier <= 3; tier++) {
      const drops = rollLoot(tier as 1 | 2 | 3, rng);
      for (const d of drops) expect(itemExists(d.itemId)).toBe(true);
    }
  });

  it("is deterministic for a fixed rng sequence", () => {
    const a = rollLoot(2, seeded(42));
    const b = rollLoot(2, seeded(42));
    expect(a).toEqual(b);
  });

  it("tier 1 never returns an empty drop list", () => {
    const rng = seeded(7);
    for (let i = 0; i < 20; i++) expect(rollLoot(1, rng).length).toBeGreaterThan(0);
  });

  it("higher tiers roll more items on average", () => {
    const avg = (tier: 1 | 2 | 3) => {
      const rng = seeded(99);
      let total = 0;
      const n = 200;
      for (let i = 0; i < n; i++) total += rollLoot(tier, rng).length;
      return total / n;
    };
    expect(avg(3)).toBeGreaterThan(avg(1));
  });
});
