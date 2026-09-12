import { describe, it, expect } from "vitest";
import { WEAPONS, byClass, shellReloadTime } from "./weapons";

describe("tube-fed shotguns", () => {
  it("flags exactly the three tube guns, and no drum gun", () => {
    const tube = byClass("shotgun").filter((id) => WEAPONS[id].tubeReload);
    expect(tube.sort()).toEqual(["benelli", "spas12", "w1200"]);
    // the drums refill as one magazine — a future drum shotgun must not
    // inherit shell-by-shell feeding just by being in the class
    expect(WEAPONS.aa12.tubeReload).toBeUndefined();
    expect(WEAPONS.origin12.tubeReload).toBeUndefined();
  });

  it("is the only class that feeds shell by shell", () => {
    const tube = Object.values(WEAPONS).filter((w) => w.tubeReload);
    expect(tube.every((w) => w.cls === "shotgun")).toBe(true);
  });

  it("splits the empty-to-full time evenly across the tube", () => {
    for (const id of ["benelli", "spas12", "w1200"]) {
      const w = WEAPONS[id];
      expect(shellReloadTime(w) * w.mag).toBeCloseTo(w.reload, 6);
    }
  });

  it("keeps every per-shell cost in a playable band", () => {
    for (const w of Object.values(WEAPONS).filter((x) => x.tubeReload)) {
      const t = shellReloadTime(w);
      expect(t).toBeGreaterThan(0.15);
      expect(t).toBeLessThan(0.35);
    }
  });
});
