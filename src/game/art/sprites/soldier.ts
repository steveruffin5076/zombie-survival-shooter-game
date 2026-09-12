/**
 * The player, as a top-down pixel-art soldier.
 *
 * Authored procedurally per facing direction rather than as 16 hand-drawn
 * bitmaps: every part is placed in (forward, side) coordinates relative to the
 * heading and rasterized onto the pixel grid at that angle. Pixels therefore
 * stay axis-aligned at every direction — rotating a finished bitmap with
 * `ctx.rotate` would smear them and throw away the whole point of pixel art.
 *
 * Body and weapon are separate sprites on purpose. The engine points the body
 * along the movement heading but the gun along the aim angle (see
 * `drawPlayer`), so baking them together would lock the two into one angle and
 * lose the twin-stick read.
 *
 * Neither draw function outlines itself — the caller composites body and gun
 * first and outlines once, or the gun's border would be stamped across the
 * body underneath it.
 */
import { PixelBuf } from "../pixel";
import { RAMPS } from "../palette";
import type { WeaponClass } from "../../weapons";

const TAU = Math.PI * 2;

/** Art-pixel size of a character sprite. 24 x PX_SCALE = 48 canvas units. */
export const SOLDIER_SIZE = 24;
/** Facing directions baked per sprite. 16 keeps rotation smooth at a glance. */
export const DIRS = 16;
/** Walk-cycle frames. */
export const FRAMES = 4;

const C = SOLDIER_SIZE / 2;

/**
 * Overhead light comes from the upper-left in SCREEN space and does not rotate
 * with the character — a light that spun with the player's facing would read
 * as the world tilting.
 */
const LIT_DX = -1;
const LIT_DY = -1;

export interface Axes {
  /** unit vector along the facing direction */
  fx: number; fy: number;
  /** unit vector 90 degrees to its right */
  sx: number; sy: number;
}

export function axesFor(dir: number, dirs = DIRS): Axes {
  const a = (dir / dirs) * TAU;
  const fx = Math.cos(a), fy = Math.sin(a);
  return { fx, fy, sx: -fy, sy: fx };
}

/**
 * Filled oval placed in (forward, side) space and oriented to the heading.
 * `rf`/`rs` are its radii along those same two axes, so a body stays wider
 * across the shoulders than front-to-back at every angle.
 */
export function blob(
  b: PixelBuf, ax: Axes, fwd: number, side: number,
  rf: number, rs: number, color: string, cx = C, cy = C,
): void {
  const ox = cx + ax.fx * fwd + ax.sx * side;
  const oy = cy + ax.fy * fwd + ax.sy * side;
  const rad = Math.ceil(Math.max(rf, rs)) + 1;
  for (let y = Math.floor(oy - rad); y <= Math.ceil(oy + rad); y++) {
    for (let x = Math.floor(ox - rad); x <= Math.ceil(ox + rad); x++) {
      const dx = x - ox, dy = y - oy;
      // project the offset back onto the forward/side axes
      const df = dx * ax.fx + dy * ax.fy;
      const ds = dx * ax.sx + dy * ax.sy;
      if ((df * df) / (rf * rf) + (ds * ds) / (rs * rs) <= 1) b.px(x, y, color);
    }
  }
}

/**
 * A tapered limb between two (forward, side) points — a run of shrinking blobs
 * rather than two endpoints. Drawing only the hand left arms as detached
 * circles floating beside the body, which is what a single blob per arm gives
 * you once the reach exceeds the torso radius.
 */
export function limb(
  b: PixelBuf, ax: Axes,
  f0: number, s0: number, f1: number, s1: number,
  r0: number, r1: number, color: string, cx = C, cy = C,
): void {
  const steps = Math.max(2, Math.ceil(Math.hypot(f1 - f0, s1 - s0)));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const r = r0 + (r1 - r0) * k;
    blob(b, ax, f0 + (f1 - f0) * k, s0 + (s1 - s0) * k, r, r, color, cx, cy);
  }
}

/**
 * One walk-cycle body pose. `frame` drives a scissoring stride; pass -1 for a
 * still idle pose.
 */
export function drawSoldier(b: PixelBuf, dir: number, frame: number): void {
  const ax = axesFor(dir);
  const phase = frame < 0 ? 0 : (frame / FRAMES) * TAU;
  const stride = frame < 0 ? 0 : Math.sin(phase) * 2.2;

  const suit = RAMPS.playerSuit;
  const rig = RAMPS.playerRig;
  const hat = RAMPS.playerHelmet;
  const skin = RAMPS.skin;
  const steel = RAMPS.steel;

  // ---- boots, scissoring fore/aft beneath the body ----
  blob(b, ax, -7.6 + stride, 3.6, 2.3, 1.9, steel[3]);
  blob(b, ax, -7.6 - stride, -3.6, 2.3, 1.9, steel[3]);

  // ---- backpack, trailing behind the shoulders ----
  blob(b, ax, -6.2, 0, 3.2, 4.8, rig[2]);
  blob(b, ax, -7.0, 0, 1.9, 3.0, rig[3]);

  // ---- torso: the widest mass, shoulders across the side axis ----
  blob(b, ax, -0.4, 0, 6.6, 8.0, suit[1]);
  // lit side, offset in screen space so the light never rotates with the body
  blob(b, ax, -0.4, 0, 4.9, 6.0, suit[0], C + LIT_DX, C + LIT_DY);
  // shadow under the near shoulder
  blob(b, ax, -1.8, 3.4, 3.4, 3.6, suit[2]);

  // ---- shoulder pads, the outermost points of the silhouette ----
  blob(b, ax, 0.8, 7.2, 3.1, 2.7, rig[1]);
  blob(b, ax, 0.8, -7.2, 3.1, 2.7, rig[1]);
  // squad marking, painted ON the left pad rather than floating beside it
  blob(b, ax, 1.4, -7.6, 1.5, 1.3, RAMPS.playerMark[1]);

  // ---- vest webbing, two straps across the chest ----
  blob(b, ax, 2.1, 0, 1.1, 7.0, rig[2]);
  blob(b, ax, -1.0, 0, 1.0, 6.5, rig[3]);
  // chest rig pouches
  blob(b, ax, 3.9, 2.5, 1.8, 2.1, rig[0]);
  blob(b, ax, 3.9, -2.5, 1.8, 2.1, rig[0]);

  // ---- helmet, sitting on top of the torso and slightly forward ----
  blob(b, ax, 1.3, 0, 4.6, 4.6, hat[2]);
  blob(b, ax, 1.6, -0.5, 3.3, 3.3, hat[1], C + LIT_DX, C + LIT_DY);
  blob(b, ax, 1.6, -0.8, 1.9, 1.9, hat[0], C + LIT_DX, C + LIT_DY);
  // brim, jutting toward the facing direction
  blob(b, ax, 5.4, 0, 1.4, 3.8, hat[3]);

  // ---- face sliver + visor, the only cue for which way "front" is ----
  blob(b, ax, 5.9, 0, 1.3, 2.6, skin[1]);
  blob(b, ax, 6.4, 0, 0.9, 2.8, RAMPS.visor[0]);

}

/**
 * Art-pixel size of a weapon sprite. Wider than the body frame: a carbine
 * barrel reaches ~16px from centre and would clip a 24px box.
 */
export const GUN_SIZE = 32;
const CG = GUN_SIZE / 2;

/** Barrel length in art pixels per class — drives the muzzle offset too. */
const GUN_LEN: Record<WeaponClass, number> = {
  pistol: 5,
  smg: 7.5,
  shotgun: 9,
  carbine: 11,
};

/**
 * Muzzle distance from the sprite centre, in ART pixels. The engine multiplies
 * by PX_SCALE to place the muzzle flash and tracer origin on the actual barrel
 * tip, rather than a constant tuned for the old vector art.
 */
export function muzzleReach(cls: WeaponClass): number {
  return 5 + GUN_LEN[cls] + 2;
}

/** The held weapon, pointing along `dir`. Centred in its own GUN_SIZE frame. */
export function drawGun(b: PixelBuf, dir: number, cls: WeaponClass): void {
  const ax = axesFor(dir);
  const steel = RAMPS.steel;
  const len = GUN_LEN[cls];
  // held out to the right side, the way the body's arm reaches across
  const side = 3.2;

  /** blob in the gun frame */
  const g = (f: number, sd: number, rf: number, rs: number, col: string, lit = false) =>
    blob(b, ax, f, sd, rf, rs, col, CG + (lit ? LIT_DX : 0), CG + (lit ? LIT_DY : 0));

  // both hands on the grip
  g(4.4, side, 1.8, 1.7, RAMPS.skin[2]);
  g(4.4, side - 2.3, 1.6, 1.5, RAMPS.skin[2]);

  // receiver
  g(5 + len / 2, side, len / 2, 1.8, steel[1]);
  // lit top edge
  g(5 + len / 2, side, len / 2 - 1, 0.9, steel[0], true);
  // barrel
  g(5 + len, side, 2.0, 1.0, steel[2]);

  // class tells, so the four read differently at gameplay size
  if (cls === "shotgun") {
    g(5 + len * 0.6, side + 1.9, len * 0.45, 0.8, steel[2]);
  }
  if (cls === "carbine") {
    g(1.4, side, 3.0, 1.4, steel[2]); // stock, back past the shoulder
    g(5.8, side + 2.7, 1.4, 2.1, steel[2]); // magazine hanging below
    g(8.0, side - 1.7, 1.8, 0.8, steel[0]); // optic rail
  }
  if (cls === "smg") {
    g(5.8, side + 2.5, 1.3, 1.9, steel[2]);
  }
  if (cls === "pistol") {
    g(5.0, side + 1.8, 1.3, 1.4, steel[2]); // stubby grip only
  }
}
