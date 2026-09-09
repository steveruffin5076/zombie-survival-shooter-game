import { describe, expect, it } from "vitest";
import {
  canPlaceAt, MAX_PER_LANE, nearestBarricade, SLOT_WIDTH, slotToWorldX, worldXToSlot,
  type Deployable,
} from "./arena";

const mk = (kind: Deployable["kind"], lane: 1 | -1, slot: number): Deployable => ({
  id: `${kind}-${lane}-${slot}`, kind, lane, slot, hp: 100, maxHp: 100, armed: true,
});

describe("canPlaceAt", () => {
  it("allows an empty slot", () => {
    expect(canPlaceAt([], 1, 0)).toBe(true);
  });
  it("rejects an occupied slot in the same lane", () => {
    expect(canPlaceAt([mk("wire", 1, 2)], 1, 2)).toBe(false);
  });
  it("allows the same slot index in the opposite lane", () => {
    expect(canPlaceAt([mk("wire", 1, 2)], -1, 2)).toBe(true);
  });
  it("rejects out-of-range slots", () => {
    expect(canPlaceAt([], 1, -1)).toBe(false);
    expect(canPlaceAt([], 1, MAX_PER_LANE)).toBe(false);
  });
  it("rejects non-integer slots", () => {
    expect(canPlaceAt([], 1, 1.5)).toBe(false);
  });
});

describe("worldXToSlot / slotToWorldX", () => {
  const centerX = 800;
  it("round-trips a slot's center back to the same slot", () => {
    for (const lane of [1, -1] as const) {
      for (let slot = 0; slot < MAX_PER_LANE; slot++) {
        const x = slotToWorldX(lane, slot, centerX);
        expect(worldXToSlot(x, centerX)).toEqual({ lane, slot });
      }
    }
  });
  it("picks lane 1 at the exact center", () => {
    expect(worldXToSlot(centerX, centerX).lane).toBe(1);
  });
  it("picks lane -1 just left of center", () => {
    expect(worldXToSlot(centerX - 1, centerX).lane).toBe(-1);
  });
  it("slot 0 covers the first SLOT_WIDTH px out from center", () => {
    expect(worldXToSlot(centerX + SLOT_WIDTH - 1, centerX).slot).toBe(0);
    expect(worldXToSlot(centerX + SLOT_WIDTH, centerX).slot).toBe(1);
  });
});

describe("nearestBarricade", () => {
  it("returns null when there are none", () => {
    expect(nearestBarricade([], 1)).toBeNull();
  });
  it("ignores other kinds and the opposite lane", () => {
    const deployables = [mk("wire", 1, 0), mk("barricade", -1, 0)];
    expect(nearestBarricade(deployables, 1)).toBeNull();
  });
  it("ignores a destroyed (hp<=0) barricade", () => {
    const dead = { ...mk("barricade", 1, 0), hp: 0 };
    expect(nearestBarricade([dead], 1)).toBeNull();
  });
  it("picks the one closest to center (lowest slot) when several exist", () => {
    const deployables = [mk("barricade", 1, 3), mk("barricade", 1, 1), mk("barricade", 1, 4)];
    expect(nearestBarricade(deployables, 1)?.slot).toBe(1);
  });
});
