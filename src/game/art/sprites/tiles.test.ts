import { describe, it, expect } from "vitest";
import { TILE_PX, TILE_VARIANTS, buildTileBufs, groundTheme, tileVariant, type GroundTheme } from "./tiles";
import { PROP_KINDS, PROP_SIZE, PROP_VARIANTS, WRECK_KIND, buildPropBufs } from "./props";

const THEMES: GroundTheme[] = ["cemetery", "suburbs", "highway", "arena"];

describe("ground tiles", () => {
  it("builds a full, non-empty set for every theme", () => {
    for (const t of THEMES) {
      const set = buildTileBufs(t);
      expect(set).toHaveLength(TILE_VARIANTS);
      for (const b of set) {
        expect([b.w, b.h]).toEqual([TILE_PX, TILE_PX]);
        expect(b.isEmpty()).toBe(false);
      }
    }
  });

  it("is pure — the same theme builds byte-identical tiles", () => {
    const a = buildTileBufs("highway");
    const b = buildTileBufs("highway");
    for (let i = 0; i < a.length; i++) expect(Array.from(a[i].data)).toEqual(Array.from(b[i].data));
  });

  it("gives each theme its own look", () => {
    const a = buildTileBufs("cemetery")[0];
    const b = buildTileBufs("arena")[0];
    expect(Array.from(a.data)).not.toEqual(Array.from(b.data));
  });

  it("makes the variants of one theme differ from each other", () => {
    const set = buildTileBufs("suburbs");
    for (let i = 1; i < set.length; i++) {
      expect(Array.from(set[i].data)).not.toEqual(Array.from(set[0].data));
    }
  });

  it("picks a variant deterministically and in range", () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 37 - 400, y = i * -19 + 250;
      const v = tileVariant(x, y);
      expect(v).toBe(tileVariant(x, y));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(TILE_VARIANTS);
    }
  });

  it("spreads variants instead of striping along a row or column", () => {
    // a weak hash (x * 31 + y) leaves whole rows on one variant, which reads as
    // banding on the floor — the thing tiling is supposed to hide
    for (const fixed of [0, 7, -13]) {
      const row = new Set(Array.from({ length: 60 }, (_, i) => tileVariant(i, fixed)));
      const col = new Set(Array.from({ length: 60 }, (_, i) => tileVariant(fixed, i)));
      expect(row.size).toBe(TILE_VARIANTS);
      expect(col.size).toBe(TILE_VARIANTS);
    }
  });

  it("falls back rather than throwing on an unknown theme id", () => {
    expect(groundTheme("cemetery")).toBe("cemetery");
    expect(groundTheme("not-a-theme")).toBe("cemetery");
  });
});

describe("decor props", () => {
  it("builds every kind at its declared size, non-empty", () => {
    for (let k = 0; k < PROP_KINDS; k++) {
      const set = buildPropBufs(k);
      expect(set.length).toBe(k === WRECK_KIND ? 4 : PROP_VARIANTS);
      for (const b of set) {
        expect([b.w, b.h]).toEqual([PROP_SIZE[k][0], PROP_SIZE[k][1]]);
        expect(b.isEmpty()).toBe(false);
      }
    }
  });

  it("makes the variants of a kind actually differ", () => {
    for (let k = 0; k < PROP_KINDS; k++) {
      const set = buildPropBufs(k);
      for (let i = 1; i < set.length; i++) {
        expect(Array.from(set[i].data)).not.toEqual(Array.from(set[0].data));
      }
    }
  });

  it("gives the wreck one variant per theme, all distinct", () => {
    const set = buildPropBufs(WRECK_KIND);
    expect(set).toHaveLength(4);
    const seen = new Set(set.map((b) => b.data.join(",")));
    expect(seen.size).toBe(4);
  });

  it("clamps an out-of-range kind instead of throwing mid-render", () => {
    expect(() => buildPropBufs(-1)).not.toThrow();
    expect(() => buildPropBufs(99)).not.toThrow();
  });
});
