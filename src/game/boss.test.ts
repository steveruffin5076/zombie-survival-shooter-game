import { describe, expect, it } from "vitest";
import { BOSS_DEFS, BOSS_WINDUP, SLAM_WINDUP_FLOOR, cooldownFor, phaseFor, pickAttack, slamWindup, windupFor } from "./boss";

describe("slamWindup / windupFor", () => {
  it("matches the base windup at phase 0", () => {
    expect(slamWindup(0)).toBeCloseTo(BOSS_WINDUP.slam, 5);
  });
  it("shrinks with phase but never drops below the floor", () => {
    expect(slamWindup(1)).toBeLessThan(slamWindup(0));
    expect(slamWindup(2)).toBeGreaterThanOrEqual(SLAM_WINDUP_FLOOR);
    expect(slamWindup(2)).toBeCloseTo(SLAM_WINDUP_FLOOR, 5);
  });
  it("windupFor defers to slamWindup only for slam", () => {
    expect(windupFor("slam", 1)).toBe(slamWindup(1));
    expect(windupFor("mortar", 2)).toBe(BOSS_WINDUP.mortar);
    expect(windupFor("call", 2)).toBe(BOSS_WINDUP.call);
  });
});

describe("cooldownFor", () => {
  it("shrinks with phase and floors at 0.9", () => {
    expect(cooldownFor(0)).toBeGreaterThan(cooldownFor(1));
    expect(cooldownFor(1)).toBeGreaterThan(cooldownFor(2));
    expect(cooldownFor(2)).toBeGreaterThanOrEqual(0.9);
  });
});

describe("pickAttack", () => {
  it("never repeats the last attack", () => {
    let last: ReturnType<typeof pickAttack> | null = null;
    for (let i = 0; i < 200; i++) {
      const next = pickAttack(last);
      expect(next).not.toBe(last);
      last = next;
    }
  });
  it("can return any of the 3 attacks when there's no last one", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickAttack(null));
    expect(seen).toEqual(new Set(["slam", "mortar", "call"]));
  });
});

describe("phaseFor", () => {
  it("splits into 3 even hp bands", () => {
    expect(phaseFor(1)).toBe(0);
    expect(phaseFor(0.67)).toBe(0);
    expect(phaseFor(0.66)).toBe(1);
    expect(phaseFor(0.34)).toBe(1);
    expect(phaseFor(0.33)).toBe(2);
    expect(phaseFor(0)).toBe(2);
  });
});

describe("BOSS_DEFS", () => {
  it("the Juggernaut's def reproduces the exact defaults (unchanged tuning)", () => {
    const def = BOSS_DEFS.juggernaut;
    expect(windupFor("mortar", 2, def)).toBe(BOSS_WINDUP.mortar);
    expect(windupFor("call", 2, def)).toBe(BOSS_WINDUP.call);
    expect(windupFor("slam", 1, def)).toBe(slamWindup(1));
    expect(cooldownFor(0, def)).toBe(cooldownFor(0));
    expect(def.hpMul).toBe(1);
  });

  it("the Watch has its own attack pool, distinct from the Juggernaut's", () => {
    const watch = BOSS_DEFS.neighborhood_watch;
    expect(watch.attacks).toContain("shieldcharge");
    expect(watch.attacks).not.toContain("slam");
  });

  it("pickAttack respects a boss's own pool and never repeats within it", () => {
    const pool = BOSS_DEFS.neighborhood_watch.attacks;
    let last: ReturnType<typeof pickAttack> | null = null;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const next = pickAttack(last, pool);
      expect(next).not.toBe(last);
      expect(pool).toContain(next);
      seen.add(next);
      last = next;
    }
    expect(seen).toEqual(new Set(pool));
  });

  it("shieldcharge windup comes from the Watch's own def, not the shared default", () => {
    const watch = BOSS_DEFS.neighborhood_watch;
    expect(windupFor("shieldcharge", 0, watch)).toBe(watch.windup.shieldcharge);
  });
});
