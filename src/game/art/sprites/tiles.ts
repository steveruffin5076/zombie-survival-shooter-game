/**
 * Ground tiles.
 *
 * The stage floor used to be one flat theme color plus a 64px scan grid. These
 * replace both: a small set of authored variants per theme, blitted across the
 * visible bounds, so the ground carries crack/stain/grit detail at the same
 * scale as the Phase 1 characters standing on it.
 *
 * Which variant lands on which tile comes from hashing the tile's coordinates,
 * so the layout is a pure function of position — identical on every run and
 * across a reload, with nothing stored and no per-tile state in the engine.
 */
import { PixelBuf } from "../pixel";

/**
 * Tile edge in ART pixels. At `PX_SCALE` 2 that is 64 world units — the same
 * spacing as the scan grid this replaces, so the floor keeps its old rhythm.
 */
export const TILE_PX = 32;

/** Authored variants per theme. */
export const TILE_VARIANTS = 5;

export type GroundTheme = "cemetery" | "suburbs" | "highway" | "arena";

const THEME_IDS: GroundTheme[] = ["cemetery", "suburbs", "highway", "arena"];

/** Narrow an arbitrary theme id, falling back rather than throwing mid-render. */
export function groundTheme(id: string): GroundTheme {
  return (THEME_IDS as string[]).includes(id) ? (id as GroundTheme) : "cemetery";
}

interface GroundPalette {
  base: string;
  mid: string;
  dark: string;
  /** the one color that says which stage this is — moss, oil, paint, scorch */
  accent: string;
  /** grit speckle, a step off `base` */
  grit: string;
}

/**
 * Deliberately brighter than the matching `THEMES[x].groundTop`. Those values
 * were the finished on-screen color; these are the color *before* the render's
 * multiply vignette darkens everything away from the player. A tile authored at
 * the old brightness reads as pure black two steps from the light pool.
 */
const GROUND: Record<GroundTheme, GroundPalette> = {
  cemetery: { base: "#2b3526", mid: "#222c1f", dark: "#182016", accent: "#3c5232", grit: "#3a4630" },
  suburbs: { base: "#35302a", mid: "#2a2620", dark: "#1e1b17", accent: "#4a3b24", grit: "#443d35" },
  highway: { base: "#2e3237", mid: "#24282c", dark: "#191c20", accent: "#3f4750", grit: "#3a4046" },
  arena: { base: "#3a302c", mid: "#2d2623", dark: "#201a18", accent: "#5a2420", grit: "#4a3c36" },
};

/** mulberry32 — a seeded PRNG so speckle is authored noise, not run-to-run noise. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Base slab: flat fill, grit speckle, and a dark seam on two edges. */
function slab(b: PixelBuf, p: GroundPalette, r: () => number) {
  b.rect(0, 0, TILE_PX, TILE_PX, p.base);
  for (let i = 0; i < 46; i++) {
    b.px(Math.floor(r() * TILE_PX), Math.floor(r() * TILE_PX), r() < 0.55 ? p.grit : p.mid);
  }
  // only two edges get the seam — all four would double up against the
  // neighbouring tile and read as a drawn grid rather than a joint
  b.row(0, TILE_PX - 1, 0, p.dark);
  b.col(0, 0, TILE_PX - 1, p.dark);
}

/** A crack wandering down the tile, with a lighter lip on one side. */
function crack(b: PixelBuf, p: GroundPalette, r: () => number, x0: number) {
  let x = x0;
  for (let y = 0; y < TILE_PX; y++) {
    b.px(x, y, p.dark);
    if (r() < 0.4) b.px(x + 1, y, p.mid);
    if (r() < 0.55) x += r() < 0.5 ? -1 : 1;
    if (x < 1) x = 1;
    if (x > TILE_PX - 2) x = TILE_PX - 2;
  }
}

/** Irregular blotch — a stain, a scorch, a patch of moss. */
function blotch(b: PixelBuf, r: () => number, cx: number, cy: number, rad: number, color: string) {
  b.oval(cx, cy, rad, rad * 0.8, color);
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2;
    const d = rad * (0.8 + r() * 0.6);
    b.px(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), color);
  }
}

/**
 * Every variant for one theme, in a fixed order. Pure: same theme in, same
 * pixels out, which is what lets the whole set be asserted under vitest.
 */
export function buildTileBufs(theme: GroundTheme): PixelBuf[] {
  const p = GROUND[theme];
  const themeSeed = THEME_IDS.indexOf(theme) * 0x9e3779b1;
  const out: PixelBuf[] = [];

  for (let v = 0; v < TILE_VARIANTS; v++) {
    const b = new PixelBuf(TILE_PX, TILE_PX);
    const r = rng(themeSeed + v * 0x85ebca6b + 1);
    slab(b, p, r);

    switch (v) {
      case 0:
        break; // plain slab — the common case, so it stays the quietest
      case 1:
        crack(b, p, r, 6 + Math.floor(r() * 6));
        crack(b, p, r, 20 + Math.floor(r() * 6));
        break;
      case 2:
        // grime, dark and translucent so the grit below still shows through
        blotch(b, r, 8 + r() * 16, 8 + r() * 16, 7 + r() * 3, p.dark + "9a");
        break;
      case 3:
        // the stage's own color, kept small — a full-tile accent tiles into wallpaper
        blotch(b, r, 6 + r() * 20, 6 + r() * 20, 5 + r() * 3, p.accent + "c0");
        for (let i = 0; i < 10; i++) {
          b.px(Math.floor(r() * TILE_PX), Math.floor(r() * TILE_PX), p.accent + "80");
        }
        break;
      case 4:
        // worn patch: lighter centre, heavier grit, one short crack
        blotch(b, r, 14 + r() * 8, 14 + r() * 8, 8 + r() * 4, p.grit + "70");
        for (let i = 0; i < 30; i++) {
          b.px(Math.floor(r() * TILE_PX), Math.floor(r() * TILE_PX), p.mid);
        }
        crack(b, p, r, 12 + Math.floor(r() * 8));
        break;
    }
    out.push(b);
  }
  return out;
}

/**
 * Which variant belongs at a tile. A full integer avalanche, not `x * 31 + y`:
 * a weak mix leaves the low bits correlated along a row and the floor visibly
 * stripes, which is exactly the artifact tiling is supposed to hide.
 */
export function tileVariant(tx: number, ty: number): number {
  let h = Math.imul(tx | 0, 0x27d4eb2d) ^ Math.imul(ty | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39);
  h ^= h >>> 16;
  return (h >>> 0) % TILE_VARIANTS;
}
