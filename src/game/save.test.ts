import { describe, expect, it } from "vitest";
import { migrate, SAVE_VERSION, type SaveData } from "./save";

const valid: SaveData = {
  version: SAVE_VERSION, runMode: "mission", stage: 2, level: 3, xp: 5, xpNext: 40,
  score: 1200, kills: 30, playTime: 210, owned: ["p365"], equipped: { pistol: "p365" },
  kind: "p365", stacks: { dmg: 2 }, deposit: [], backpack: [{ id: "a", itemId: "bandage", x: 0, y: 0 }],
  intel: 4, hideout: null,
};

describe("migrate", () => {
  it("round-trips a well-formed save unchanged (besides normalization)", () => {
    expect(migrate(valid)).toEqual(valid);
  });

  it("rejects null/non-object input", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate("nonsense")).toBeNull();
    expect(migrate(42)).toBeNull();
  });

  it("rejects a save from a newer version than this build understands", () => {
    expect(migrate({ ...valid, version: SAVE_VERSION + 1 })).toBeNull();
  });

  it("rejects a save missing required array fields", () => {
    const { owned: _owned, ...broken } = valid;
    expect(migrate(broken)).toBeNull();
  });

  it("fills in sensible defaults for optional fields", () => {
    const minimal = {
      version: 1, stage: 1, level: 1, owned: ["p365"], deposit: [], backpack: [],
    };
    const result = migrate(minimal);
    expect(result).not.toBeNull();
    expect(result?.xp).toBe(0);
    expect(result?.score).toBe(0);
    expect(result?.kind).toBe("p365");
    expect(result?.runMode).toBe("endless");
    expect(result?.hideout).toBeNull();
  });

  it("always forces hideout to null regardless of what's in the raw data", () => {
    const result = migrate({ ...valid, hideout: { someFutureField: true } });
    expect(result?.hideout).toBeNull();
  });
});
