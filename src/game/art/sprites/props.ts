/**
 * Decor props, seen from directly above.
 *
 * These replace `drawDecor`'s vector shapes. The kinds and their per-theme
 * spawn weights already existed in `themes.ts` — only the draw path changes.
 *
 * Per-instance variety is three authored variants per kind, not a scale
 * factor. The old decor carried `s: R(0.7, 1.25)` and scaled its vectors by it;
 * doing that to a bitmap resamples it off the pixel grid and turns the art to
 * mush, which is the same reason Phase 1 pre-renders a pose per facing instead
 * of rotating one.
 */
import { PixelBuf } from "../pixel";

/** tombstone-a, tombstone-b, tree, lamp, car, barrier, rubble, stage wreck */
export const PROP_KINDS = 8;
export const PROP_VARIANTS = 3;

/**
 * Kind 7 is the per-stage set-piece and is never rolled by the weighted decor
 * spawner — the engine places exactly one per stage. Its four "variants" are
 * the four themes rather than three cosmetic passes, which is why `prop()`
 * indexes modulo the built set's own length instead of `PROP_VARIANTS`.
 */
export const WRECK_KIND = 7;

/**
 * Sprite footprint per kind, in ART pixels. Sized to roughly 2x that kind's
 * `DECOR_SOLID_R` so the art matches the hitbox it is standing in for — the
 * lesson from Phase 1, where the old vectors drew about half their own
 * collision size. The tree is the deliberate exception: its canopy overhangs a
 * trunk-sized hitbox, which is how a real tree reads from above.
 */
export const PROP_SIZE: readonly (readonly [number, number])[] = [
  [12, 16], // 0 tombstone slab
  [14, 14], // 1 tombstone block
  [22, 22], // 2 dead tree canopy
  [8, 8], // 3 lamp pole
  [18, 30], // 4 wrecked car
  [12, 24], // 5 jersey barrier
  [18, 18], // 6 rubble pile
  [56, 40], // 7 stage set-piece wreck — ~112x80 world units
];

const P = {
  stone: ["#5a6478", "#465066", "#333c4e", "#222938"],
  moss: "#3c5232",
  bark: ["#463b2e", "#352c22", "#251f18", "#171310"],
  metal: ["#4a5058", "#383e46", "#282d34", "#191d22"],
  rust: ["#7a4e2c", "#5c3a20", "#3f2816"],
  glass: "#2a3a44",
  concrete: ["#57544c", "#43413a", "#312f2a", "#201f1b"],
  hazard: "#b08828",
  dark: "#12151a",
} as const;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Speckle a body with its own darker steps so a flat fill reads as material. */
function grain(b: PixelBuf, r: () => number, ramp: readonly string[], n: number) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * b.w);
    const y = Math.floor(r() * b.h);
    if (b.get(x, y)[3] === 0) continue; // only inside the silhouette
    b.px(x, y, ramp[1 + Math.floor(r() * 2)]);
  }
}

function tombstoneSlab(b: PixelBuf, v: number, r: () => number) {
  const w = b.w, h = b.h;
  // the slab, with a rounded head on the taller variants
  b.rect(1, 2, w - 2, h - 3, P.stone[1]);
  b.oval(w / 2 - 0.5, 3, w / 2 - 1, 2.5, P.stone[1]);
  // lit top edge, shadowed foot
  b.row(1, w - 2, 2, P.stone[0]);
  b.row(1, w - 2, h - 2, P.stone[3]);
  // engraved cross, offset per variant
  const cx = Math.floor(w / 2), cy = 6 + v;
  b.col(cx, cy, cy + 5, P.stone[3]);
  b.row(cx - 2, cx + 2, cy + 2, P.stone[3]);
  if (v === 2) {
    // cracked and leaning: a fracture across the face
    b.line(1, h - 6, w - 2, h - 9, P.stone[3]);
  }
  if (v === 1) for (let i = 0; i < 5; i++) b.px(1 + Math.floor(r() * (w - 2)), h - 4 + Math.floor(r() * 2), P.moss);
  grain(b, r, P.stone, 14);
}

function tombstoneBlock(b: PixelBuf, v: number, r: () => number) {
  const w = b.w, h = b.h;
  b.rect(1, 1, w - 2, h - 2, P.stone[1]);
  b.row(1, w - 2, 1, P.stone[0]);
  b.col(1, 1, h - 2, P.stone[0]);
  b.row(1, w - 2, h - 2, P.stone[3]);
  b.col(w - 2, 1, h - 2, P.stone[3]);
  // a sunken panel — the top face of a chest tomb
  b.rect(3 + (v === 1 ? 1 : 0), 3, w - 6, h - 6, P.stone[2]);
  if (v === 2) b.line(2, 3, w - 3, h - 4, P.stone[3]);
  if (v === 0) for (let i = 0; i < 6; i++) b.px(2 + Math.floor(r() * (w - 4)), 2 + Math.floor(r() * (h - 4)), P.moss);
  grain(b, r, P.stone, 16);
}

function deadTree(b: PixelBuf, v: number, r: () => number) {
  const cx = b.w / 2 - 0.5, cy = b.h / 2 - 0.5;
  const reach = cx - 1;
  // A dead tree from above is mostly negative space: bare limbs radiating from
  // a trunk, with ground visible between them. The first pass drew a filled
  // lobed canopy and read as a mound of dirt — foliage is exactly what this
  // tree doesn't have.
  const limbs = 5 + v;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + v * 0.5 + r() * 0.3;
    const len = reach * (0.65 + r() * 0.35);
    const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
    b.line(cx, cy, ex, ey, P.bark[2]);
    // a second line one pixel off gives the limb weight near the trunk
    b.line(cx, cy + 1, cx + Math.cos(a) * len * 0.55, cy + 1 + Math.sin(a) * len * 0.55, P.bark[3]);
    // each limb forks twice toward its tip
    for (const [at, sp] of [[0.6, 0.7], [0.85, -0.9]] as const) {
      const bx = cx + Math.cos(a) * len * at, by = cy + Math.sin(a) * len * at;
      const fa = a + sp;
      const fl = len * (0.3 + r() * 0.2);
      b.line(bx, by, bx + Math.cos(fa) * fl, by + Math.sin(fa) * fl, P.bark[2]);
    }
  }
  // trunk crown, lit on top
  b.oval(cx, cy, 2.6, 2.6, P.bark[2]);
  b.oval(cx, cy, 1.8, 1.8, P.bark[1]);
  b.oval(cx - 0.5, cy - 0.5, 1, 1, P.bark[0]);
  grain(b, r, P.bark, 10);
}

function lampPole(b: PixelBuf, v: number) {
  const cx = b.w / 2 - 0.5, cy = b.h / 2 - 0.5;
  if (v === 1) {
    // square fixture — a different pole on the same street
    b.rect(cx - 2.5, cy - 2.5, 6, 6, P.metal[2]);
    b.rect(cx - 1.5, cy - 1.5, 4, 4, P.metal[1]);
    b.rect(cx - 0.5, cy - 0.5, 2, 2, "#fdba74");
    return;
  }
  b.oval(cx, cy, 3, 3, P.metal[2]);
  b.oval(cx, cy, 2, 2, P.metal[1]);
  if (v === 2) {
    // dead: the housing is there, the bulb is out and the glass is broken
    b.oval(cx, cy, 1, 1, "#8a7a5a");
    b.px(cx - 2, cy - 2, P.metal[3]);
    b.px(cx + 2, cy + 1, P.metal[3]);
    return;
  }
  b.oval(cx, cy, 1, 1, "#fdba74");
}

function wreckedCar(b: PixelBuf, v: number, r: () => number) {
  const w = b.w, h = b.h;
  b.rect(2, 1, w - 4, h - 2, P.metal[2]); // body shell
  b.row(2, w - 3, 1, P.metal[1]);
  b.rect(3, 6, w - 6, 10, P.metal[1]); // roof
  b.rect(4, 7, w - 8, 8, P.glass); // cabin glass, seen through
  b.rect(3, 2, w - 6, 3, P.metal[3]); // hood shadow
  b.rect(3, h - 6, w - 6, 4, P.metal[3]); // boot shadow
  // wheels sit proud of the body
  for (const wy of [4, h - 6]) {
    b.rect(0, wy, 2, 4, P.dark);
    b.rect(w - 2, wy, 2, 4, P.dark);
  }
  if (v === 1) {
    // burnt out: roof gone, rust through the shell
    b.rect(4, 7, w - 8, 8, P.dark);
    for (let i = 0; i < 22; i++) b.px(2 + Math.floor(r() * (w - 4)), 1 + Math.floor(r() * (h - 2)), P.rust[1]);
  }
  if (v === 2) {
    // rolled: the whole shell in rust, glass out
    for (let i = 0; i < 34; i++) b.px(2 + Math.floor(r() * (w - 4)), 1 + Math.floor(r() * (h - 2)), P.rust[Math.floor(r() * 3)]);
  }
  grain(b, r, P.metal, 18);
}

function jerseyBarrier(b: PixelBuf, v: number, r: () => number) {
  const w = b.w, h = b.h;
  b.rect(1, 1, w - 2, h - 2, P.concrete[1]);
  b.col(1, 1, h - 2, P.concrete[0]); // lit long edge
  b.col(w - 2, 1, h - 2, P.concrete[3]);
  b.row(1, w - 2, 1, P.concrete[0]);
  b.row(1, w - 2, h - 2, P.concrete[3]);
  // hazard bands across the top face
  for (const y of [5, h - 8]) b.rect(2, y, w - 4, 2, P.hazard);
  if (v === 1) b.line(1, 8, w - 2, 13, P.concrete[3]); // chipped
  if (v === 2) {
    // knocked about: a corner missing
    b.rect(1, 1, 4, 4, "#00000000");
    for (let i = 0; i < 10; i++) b.px(1 + Math.floor(r() * (w - 2)), 1 + Math.floor(r() * (h - 2)), P.concrete[3]);
  }
  grain(b, r, P.concrete, 12);
}

function rubblePile(b: PixelBuf, v: number, r: () => number) {
  const cx = b.w / 2 - 0.5, cy = b.h / 2 - 0.5;
  // a heap of broken slabs at assorted angles
  const chunks = 6 + v * 2;
  for (let i = 0; i < chunks; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * cx * 0.75;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const cw = 3 + Math.floor(r() * 4), ch = 3 + Math.floor(r() * 4);
    b.rect(x - cw / 2, y - ch / 2, cw, ch, P.concrete[1 + Math.floor(r() * 3)]);
    // a lit top edge and a shadowed bottom on every chunk — without both, the
    // heap flattens into one silhouette at gameplay size
    b.row(x - cw / 2, x + cw / 2 - 1, y - ch / 2, P.concrete[0]);
    b.row(x - cw / 2, x + cw / 2 - 1, y + ch / 2 - 1, "#1a1916");
  }
  // exposed rebar lying across the pile
  for (let i = 0; i < 2 + v; i++) {
    const a = r() * Math.PI;
    b.line(cx - Math.cos(a) * cx * 0.7, cy - Math.sin(a) * cy * 0.7,
      cx + Math.cos(a) * cx * 0.7, cy + Math.sin(a) * cy * 0.7, P.rust[1]);
  }
  grain(b, r, P.concrete, 16);
}


/* ---------------- stage set-pieces, one per theme ---------------- */

/** Collapsed mausoleum — cemetery. */
function cryptWreck(b: PixelBuf, r: () => number) {
  const w = b.w, h = b.h;
  b.rect(6, 4, w - 12, h - 8, P.stone[2]);
  b.rect(8, 6, w - 16, h - 12, P.stone[1]);
  b.row(8, w - 9, 6, P.stone[0]);
  // the roof has fallen in down the middle
  b.oval(w / 2, h / 2, 11, 7, P.dark);
  for (let i = 0; i < 26; i++) {
    const x = w / 2 + (r() - 0.5) * 24, y = h / 2 + (r() - 0.5) * 16;
    b.rect(x, y, 2 + r() * 3, 2 + r() * 3, P.stone[1 + Math.floor(r() * 3)]);
  }
  // columns at the four corners, still standing
  for (const [cx, cy] of [[7, 5], [w - 8, 5], [7, h - 6], [w - 8, h - 6]] as const) {
    b.oval(cx, cy, 2.4, 2.4, P.stone[0]);
    b.oval(cx, cy, 1.4, 1.4, P.stone[2]);
  }
  grain(b, r, P.stone, 40);
}

/** Overturned school bus — suburbs. */
function busWreck(b: PixelBuf, r: () => number) {
  const w = b.w, h = b.h;
  b.rect(3, 9, w - 6, h - 18, P.rust[1]); // body, lying on its side
  b.row(3, w - 4, 9, "#8a6a2a"); // the one stripe that says school bus
  b.row(3, w - 4, h - 10, P.rust[2]);
  for (let x = 7; x < w - 8; x += 7) {
    b.rect(x, 13, 4, 7, P.glass); // window band
    b.px(x + 1, 14, "#3d525e");
  }
  b.rect(w - 12, 11, 8, h - 22, P.rust[0]); // crumpled nose
  for (const wx of [9, 22, w - 16]) { // wheels up, off the ground
    b.rect(wx, 4, 5, 5, P.dark);
    b.rect(wx + 1, 5, 3, 3, P.metal[2]);
  }
  for (let i = 0; i < 40; i++) b.px(3 + Math.floor(r() * (w - 6)), 9 + Math.floor(r() * (h - 18)), P.rust[Math.floor(r() * 3)]);
  grain(b, r, P.metal, 24);
}

/** Jackknifed semi — highway. */
function semiWreck(b: PixelBuf, r: () => number) {
  const w = b.w, h = b.h;
  b.rect(2, 12, w - 20, h - 22, P.metal[1]); // trailer
  b.row(2, w - 19, 12, P.metal[0]);
  b.row(2, w - 19, h - 11, P.metal[3]);
  for (let x = 5; x < w - 22; x += 6) b.col(x, 13, h - 12, P.metal[2]); // ribs
  b.rect(w - 17, 6, 14, h - 12, P.rust[1]); // cab, folded across
  b.rect(w - 14, 9, 8, 7, P.glass);
  b.rect(w - 15, h - 12, 10, 4, P.metal[3]);
  for (const [wx, wy] of [[6, h - 9], [16, h - 9], [w - 16, 4], [w - 8, 4]] as const) {
    b.rect(wx, wy, 5, 4, P.dark);
  }
  // spilled load
  for (let i = 0; i < 22; i++) {
    const x = 4 + r() * (w - 24), y = h - 8 + r() * 6;
    b.rect(x, y, 2 + r() * 3, 2 + r() * 2, P.concrete[1 + Math.floor(r() * 3)]);
  }
  grain(b, r, P.metal, 30);
}

/** Downed helicopter — arena. */
function heloWreck(b: PixelBuf, r: () => number) {
  const w = b.w, h = b.h;
  const cx = w / 2, cy = h / 2;
  b.oval(cx - 4, cy, 15, 8, P.metal[2]); // fuselage
  b.oval(cx - 4, cy, 13, 6, P.metal[1]);
  b.oval(cx - 13, cy, 5, 5, P.glass); // nose glass
  b.rect(cx + 8, cy - 2, 18, 4, P.metal[2]); // tail boom
  b.rect(w - 9, cy - 6, 3, 12, P.metal[1]); // tail fin
  // main rotor, bent — three blades at uneven angles
  for (const a of [0.15, 2.3, 4.1]) {
    b.line(cx - 4, cy, cx - 4 + Math.cos(a) * 24, cy + Math.sin(a) * 15, P.metal[0]);
  }
  b.oval(cx - 4, cy, 2.5, 2.5, P.metal[3]); // rotor head
  // scorching around the impact
  for (let i = 0; i < 34; i++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 16;
    b.px(Math.round(cx - 4 + Math.cos(a) * d * 1.5), Math.round(cy + Math.sin(a) * d), "#241a16");
  }
  for (let i = 0; i < 18; i++) b.px(Math.floor(r() * w), Math.floor(r() * h), P.rust[Math.floor(r() * 3)]);
  grain(b, r, P.metal, 26);
}

const WRECKS = [cryptWreck, busWreck, semiWreck, heloWreck];

const BUILDERS = [
  tombstoneSlab, tombstoneBlock, deadTree,
  (b: PixelBuf, v: number, _r: () => number) => lampPole(b, v),
  wreckedCar, jerseyBarrier, rubblePile,
  // kind 7 dispatches on theme rather than cosmetic variant — see WRECK_KIND
  (b: PixelBuf, v: number, r: () => number) => WRECKS[v % WRECKS.length](b, r),
];

/**
 * Every variant of one decor kind. Pure: same kind in, same pixels out.
 * Outlined once at the end — a prop against a dark floor needs the separation,
 * and outlining inside each builder would stamp borders through overlapping
 * chunks (the Phase 1 composite-then-outline rule).
 */
export function buildPropBufs(kind: number): PixelBuf[] {
  const k = Math.max(0, Math.min(PROP_KINDS - 1, kind | 0));
  const [w, h] = PROP_SIZE[k];
  const out: PixelBuf[] = [];
  const count = k === WRECK_KIND ? WRECKS.length : PROP_VARIANTS;
  for (let v = 0; v < count; v++) {
    const b = new PixelBuf(w, h);
    BUILDERS[k](b, v, rng(k * 0x9e3779b1 + v * 0x85ebca6b + 7));
    if (k !== 3) b.outline("#0a0d12"); // the lamp is a light source, not a solid
    out.push(b);
  }
  return out;
}
