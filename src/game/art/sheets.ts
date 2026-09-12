/**
 * Sprite-set builders: every pose of every entity, as pure `PixelBuf`s.
 *
 * Kept separate from `cache.ts` so the whole sprite set can be built and
 * asserted on under vitest's `node` environment — there is no `document` or
 * `ImageData` here. `cache.ts` owns the thin DOM seam that turns these buffers
 * into blittable canvases.
 *
 * Outlining happens here, once, after a body is complete — see the note in
 * `soldier.ts` about why the draw functions don't outline themselves.
 */
import { PixelBuf } from "./pixel";
import { OUTLINE } from "./palette";
import {
  DIRS, FRAMES, GUN_SIZE, SOLDIER_SIZE, drawGun, drawSoldier,
} from "./sprites/soldier";
import {
  Z_DIRS, Z_FRAMES, Z_SIZE, Z_VARIANTS, drawZombie, type ZSpriteType,
} from "./sprites/zombies";
import type { WeaponClass } from "../weapons";

/** Index of a pose within a flat sprite array: dir-major, then frame. */
export function poseIndex(dir: number, frame: number, frames: number): number {
  return dir * frames + frame;
}

/** The player body, every facing x every walk frame. */
export function buildSoldierBufs(): PixelBuf[] {
  const out: PixelBuf[] = [];
  for (let d = 0; d < DIRS; d++) {
    for (let f = 0; f < FRAMES; f++) {
      const b = new PixelBuf(SOLDIER_SIZE, SOLDIER_SIZE);
      drawSoldier(b, d, f);
      b.outline(OUTLINE);
      out.push(b);
    }
  }
  return out;
}

/** One weapon class, every facing. Guns don't animate, so there are no frames. */
export function buildGunBufs(cls: WeaponClass): PixelBuf[] {
  const out: PixelBuf[] = [];
  for (let d = 0; d < DIRS; d++) {
    const b = new PixelBuf(GUN_SIZE, GUN_SIZE);
    drawGun(b, d, cls);
    b.outline(OUTLINE);
    out.push(b);
  }
  return out;
}

/**
 * One zombie type: every variant x facing x shamble frame, flattened
 * variant-major so a given instance picks its variant once and then indexes
 * poses exactly like the player does.
 */
export function buildZombieBufs(type: ZSpriteType): PixelBuf[] {
  const size = Z_SIZE[type];
  const out: PixelBuf[] = [];
  for (let v = 0; v < Z_VARIANTS; v++) {
    for (let d = 0; d < Z_DIRS; d++) {
      for (let f = 0; f < Z_FRAMES; f++) {
        const b = new PixelBuf(size, size);
        drawZombie(b, type, d, f, v);
        b.outline(OUTLINE);
        out.push(b);
      }
    }
  }
  return out;
}

/** Count of poses in one zombie type's flat array. */
export const Z_POSES = Z_VARIANTS * Z_DIRS * Z_FRAMES;

/** Index into `buildZombieBufs`'s flat array. */
export function zombieIndex(variant: number, dir: number, frame: number): number {
  return (variant * Z_DIRS + dir) * Z_FRAMES + frame;
}

const TAU = Math.PI * 2;

/**
 * Snap a world-space angle (radians, +x = 0, as `Math.atan2` returns) to one of
 * `dirs` pre-rendered facings. Negative angles and angles past TAU both wrap,
 * so callers can pass `atan2` output straight through.
 */
export function dirFor(angle: number, dirs: number): number {
  const k = Math.round((angle / TAU) * dirs);
  return ((k % dirs) + dirs) % dirs;
}
