/**
 * The five zombie types as top-down pixel art.
 *
 * The old vector art drew every type as the same oval with a `bulk` multiplier,
 * so in a crowd they were told apart only by size. Here each type gets its own
 * SILHOUETTE — the thing that actually reads at gameplay speed — and its own
 * flesh/rag ramps from `palette.ts` on top of that.
 *
 * Sprite sizes are derived from each type's collision radius in engine.ts's
 * ZCONF (walker 19, runner ~13, spitter ~15, brute 45, screamer ~13), so what
 * the player sees is what they can actually shoot. The previous art was
 * noticeably smaller than its own hitbox.
 *
 * Like the soldier, nothing here outlines itself; the atlas outlines once
 * after the body is complete.
 */
import { PixelBuf } from "../pixel";
import { CLAW, EYE_ALERT, EYE_HOSTILE, RAMPS, ZOMBIE_RAMPS } from "../palette";
import { axesFor, blob, limb } from "./soldier";

const TAU = Math.PI * 2;

export type ZSpriteType = "walker" | "runner" | "brute" | "spitter" | "screamer";

/** Facings baked per zombie. Half the player's 16 — they turn far more slowly. */
export const Z_DIRS = 8;
/** Shamble-cycle frames. */
export const Z_FRAMES = 4;
/**
 * Body variants per type. `mkZombie` gives every instance a random `tint`,
 * which used to pick a flat color; it now picks a variant instead, so a crowd
 * varies without per-instance scaling that would break pixel alignment.
 */
export const Z_VARIANTS = 2;

/** Art-pixel frame size per type — roughly 2x the type's collision radius. */
export const Z_SIZE: Record<ZSpriteType, number> = {
  walker: 24,
  runner: 18,
  spitter: 20,
  brute: 52,
  screamer: 18,
};

const LIT_DX = -1;
const LIT_DY = -1;

interface Shape {
  /** torso radii along the forward and side axes */
  rf: number; rs: number;
  /** head offset forward of centre, and its radius */
  headF: number; headR: number;
  /** how far the arms reach forward, and their spread to each side */
  armF: number; armS: number;
  /** leg offset behind centre and their stride amplitude */
  legF: number; stride: number;
}

/**
 * Per-type proportions, as a fraction of the sprite's half-size, so one set of
 * numbers describes a 18px runner and a 52px brute alike.
 */
const SHAPES: Record<ZSpriteType, Shape> = {
  // upright and roughly symmetric — the baseline everything else reads against
  walker: { rf: 0.42, rs: 0.50, headF: 0.30, headR: 0.26, armF: 0.62, armS: 0.46, legF: -0.52, stride: 0.14 },
  // leaning forward with its arms trailing back — a body mid-sprint. Kept from
  // stretching too far along the forward axis, which at 18px read as a
  // four-legged animal rather than a person running
  runner: { rf: 0.46, rs: 0.40, headF: 0.42, headR: 0.24, armF: -0.26, armS: 0.44, legF: -0.54, stride: 0.26 },
  // enormously wide, head sunk between the shoulders, forearms out front
  brute: { rf: 0.44, rs: 0.68, headF: 0.20, headR: 0.20, armF: 0.70, armS: 0.62, legF: -0.46, stride: 0.10 },
  // bloated and round, with a sac on its back
  spitter: { rf: 0.50, rs: 0.52, headF: 0.36, headR: 0.24, armF: 0.44, armS: 0.44, legF: -0.48, stride: 0.10 },
  // thin, head thrown back, arms splayed wide
  screamer: { rf: 0.38, rs: 0.38, headF: 0.32, headR: 0.28, armF: 0.34, armS: 0.62, legF: -0.50, stride: 0.12 },
};

/**
 * One zombie pose. `variant` selects a body variation; `frame` drives the
 * shamble. Drawn centred in a `Z_SIZE[type]` square.
 */
export function drawZombie(
  b: PixelBuf, type: ZSpriteType, dir: number, frame: number, variant = 0,
): void {
  const size = Z_SIZE[type];
  const C = size / 2;
  const ax = axesFor(dir, Z_DIRS);
  const sh = SHAPES[type];
  const { flesh, cloth } = ZOMBIE_RAMPS[type];

  // half-size is the unit every proportion above is expressed in
  const U = C;
  const phase = (frame / Z_FRAMES) * TAU;
  // the two variants shamble out of phase, so a crowd never moves in lockstep
  const ph = phase + (variant ? Math.PI * 0.5 : 0);
  const swing = Math.sin(ph);
  const lurch = Math.cos(ph * 0.5) * 0.4;

  const g = (f: number, s: number, rf: number, rs: number, col: string, lit = false) =>
    blob(b, ax, f * U, s * U, rf * U, rs * U, col,
      C + (lit ? LIT_DX : 0), C + (lit ? LIT_DY : 0));
  /** connected limb, in the same fractional units as `g` */
  const lm = (f0: number, s0: number, f1: number, s1: number, r0: number, r1: number, col: string) =>
    limb(b, ax, f0 * U, s0 * U, f1 * U, s1 * U, r0 * U, r1 * U, col, C, C);

  // ---- legs, dragging behind and joined to the hips ----
  const st = sh.stride * swing;
  lm(sh.legF * 0.4, 0.20, sh.legF + st, 0.26, 0.13, 0.10, flesh[3]);
  lm(sh.legF * 0.4, -0.20, sh.legF - st, -0.26, 0.13, 0.10, flesh[3]);

  // ---- spitter's acid sac, on its back, before the torso covers it ----
  if (type === "spitter") {
    g(-0.44, 0, 0.26, 0.30, RAMPS.rotSick[0]);
    g(-0.48, 0.08, 0.14, 0.16, "#a3e63588");
  }

  // ---- torso, in torn clothing ----
  g(lurch * 0.06, 0, sh.rf, sh.rs, cloth[1]);
  g(lurch * 0.06, 0, sh.rf * 0.72, sh.rs * 0.72, cloth[0], true);
  // exposed flesh where the clothing is torn through
  const tearR = Math.min(sh.rf * 0.34, 3.4 / U);
  g(0.10, variant ? 0.16 : -0.16, tearR, tearR * 0.9, flesh[2]);
  // a dark wound, so every body carries some damage. Capped in absolute art
  // pixels rather than scaled with the body — a fraction of a brute is a patch
  // the size of a walker's whole torso.
  const woundR = Math.min(sh.rf * 0.22, 2.2 / U);
  g(-0.10, variant ? -0.20 : 0.20, woundR, woundR * 0.9, RAMPS.blood[3]);

  // ---- brute's shoulder slabs: the whole point of its silhouette ----
  if (type === "brute") {
    g(0.12, 0.62, 0.30, 0.26, flesh[1]);
    g(0.12, -0.62, 0.30, 0.26, flesh[1]);
    g(0.12, 0.62, 0.18, 0.16, flesh[0], true);
    g(0.12, -0.62, 0.18, 0.16, flesh[0], true);
  }

  // ---- arms ----
  // ---- arms: shoulder to hand as one tapered limb, so they stay attached ----
  const reach = sh.armF + swing * 0.06;
  const armR = type === "brute" ? 0.17 : 0.11;
  const shF = sh.rf * 0.25, shS = sh.rs * 0.80;
  lm(shF, shS, reach, sh.armS, armR, armR * 0.75, flesh[1]);
  lm(shF, -shS, reach - swing * 0.1, -sh.armS, armR, armR * 0.75, flesh[2]);
  // hands
  g(reach, sh.armS, armR * 0.95, armR * 0.95, flesh[0], true);
  g(reach - swing * 0.1, -sh.armS, armR * 0.95, armR * 0.95, flesh[1], true);
  // claws — a few near-white pixels past the hands read as menace at this size
  if (type !== "spitter") {
    g(reach + armR * 1.1, sh.armS + 0.04, 0.05, 0.04, CLAW);
    g(reach + armR * 1.0 - swing * 0.1, -sh.armS - 0.04, 0.05, 0.04, CLAW);
  }

  // ---- head, on a short neck so it reads as attached ----
  lm(sh.rf * 0.3, 0, sh.headF, lurch * 0.08, sh.headR * 0.5, sh.headR * 0.7, flesh[2]);
  g(sh.headF, lurch * 0.08, sh.headR, sh.headR, flesh[1]);
  g(sh.headF, lurch * 0.08, sh.headR * 0.62, sh.headR * 0.62, flesh[0], true);

  if (type === "screamer") {
    // mouth thrown wide — her tell, and the reason to shoot her first
    g(sh.headF + 0.16, 0, sh.headR * 0.6, sh.headR * 0.7, "#2a1016");
    g(sh.headF + 0.20, 0, sh.headR * 0.34, sh.headR * 0.42, EYE_ALERT);
  } else {
    // hanging jaw
    g(sh.headF + 0.18, 0.06, sh.headR * 0.42, sh.headR * 0.46, flesh[2]);
    g(sh.headF + 0.22, 0.06, sh.headR * 0.22, sh.headR * 0.26, "#2a1016");
  }

  // eyes, the clearest "it has seen you" cue on the sprite
  const eye = type === "screamer" ? EYE_ALERT : EYE_HOSTILE;
  g(sh.headF + 0.10, 0.13, 0.05, 0.05, eye);
  g(sh.headF + 0.10, -0.13, 0.05, 0.05, eye);
}
