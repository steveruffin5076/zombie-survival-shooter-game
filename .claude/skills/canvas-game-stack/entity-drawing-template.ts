/**
 * Entity Drawing Template
 *
 * Copy this file into your project and adapt the entity type, proportions, and colors
 * to match your game. This template shows the structure for a complete, animated entity.
 *
 * A simple entity needs:
 * 1. Size, direction count, frame count constants
 * 2. A shape definition (proportions as fractions of half-size)
 * 3. A drawing function that uses blob() and limb()
 */

import { PixelBuf, Axes, axesFor, blob, limb, rampFrom } from "./pixel-buffer-template";

const TAU = Math.PI * 2;

/**
 * Example: Enemy Entity
 * Adapt these constants to your game's art style.
 */

/** Art-pixel size of this entity's sprite. */
export const ENTITY_SIZE = 32;

/** Number of facing directions to bake. More = smoother rotation, more memory. */
export const ENTITY_DIRS = 8;

/** Number of frames in the animation cycle (walk, shamble, stomp, etc). */
export const ENTITY_FRAMES = 4;

/**
 * Shape proportions as fractions of half-size (ENTITY_SIZE / 2).
 * This one example defines a humanoid zombie-like shape.
 *
 * All proportions are relative to U = ENTITY_SIZE / 2, so the same shape
 * scales smoothly if you later want variants at different sizes.
 */
interface EntityShape {
  torsoForward: number;  // rf
  torsoSide: number;     // rs
  headForward: number;   // offset from center
  headRadius: number;
  armForward: number;
  armSide: number;
  legForward: number;
  legStride: number;
}

const SHAPE: EntityShape = {
  torsoForward: 0.42,
  torsoSide: 0.50,
  headForward: 0.30,
  headRadius: 0.26,
  armForward: 0.62,
  armSide: 0.46,
  legForward: -0.52,
  legStride: 0.14,
};

/**
 * Animation state: typically just frame and direction index.
 * Add custom properties for boss states, emotes, etc.
 */
export interface EntityAnimState {
  dir: number;   // 0 to ENTITY_DIRS - 1
  frame: number; // 0 to ENTITY_FRAMES - 1
  variant?: number; // optional: 0, 1, etc. for crowd variation
}

/**
 * Color palette for this entity type.
 * Derived from base colors using rampFrom() for automatic lighting.
 */
interface EntityPalette {
  primary: string;   // main body color
  secondary: string; // accent or clothing
  dark: string;      // eyes, details
}

function getEntityPalette(type: string): EntityPalette {
  // Example: different color schemes per entity type
  const baseColors: Record<string, { primary: string; secondary: string; dark: string }> = {
    common: { primary: "#6b5344", secondary: "#3a3a3a", dark: "#1a1a1a" },
    elite: { primary: "#8b5a3c", secondary: "#2a4a4a", dark: "#0a0a0a" },
  };

  const colors = baseColors[type] || baseColors.common;
  return {
    primary: colors.primary,
    secondary: colors.secondary,
    dark: colors.dark,
  };
}

/**
 * Draw one frame of the entity.
 *
 * @param b PixelBuf to draw into
 * @param type entity variant (e.g., "common", "elite")
 * @param state animation state (dir, frame, variant)
 */
export function drawEntity(
  b: PixelBuf,
  type: string,
  state: EntityAnimState,
): void {
  const C = ENTITY_SIZE / 2;
  const U = C;
  const ax = axesFor(state.dir, ENTITY_DIRS);

  // Get the color palette for this entity type
  const palette = getEntityPalette(type);
  const [brightPrimary, litPrimary, basePrimary, darkPrimary] = rampFrom(palette.primary);
  const [, litSecondary, baseSecondary] = rampFrom(palette.secondary);

  // Animation phase: drive the shamble/walk cycle
  const phase = (state.frame / ENTITY_FRAMES) * TAU;
  const variant = state.variant ?? 0;

  // For crowds, offset phase by variant so they don't move in lockstep
  const phaseOffset = (variant / Math.max(1, 2)) * TAU;
  const animPhase = phase + phaseOffset;

  // Swing: limbs move left-right (opposite each other)
  const swing = Math.sin(animPhase);

  // Lurch: body bounces up-down (half frequency of limb swing)
  const lurch = Math.cos(animPhase * 0.5) * 0.08;

  // Helper to draw a blob at (forward, side) coordinates
  const g = (
    fwd: number, side: number,
    rf: number, rs: number,
    color: string,
  ) => blob(b, ax, fwd * U, side * U, rf * U, rs * U, color, C, C);

  // Helper to draw a limb between two (forward, side) points
  const l = (
    f0: number, s0: number, f1: number, s1: number,
    r0: number, r1: number,
    color: string,
  ) => limb(b, ax, f0 * U, s0 * U, f1 * U, s1 * U, r0 * U, r1 * U, color, C, C);

  // ---- Legs: planted, with stride amplitude driven by swing ----
  const legSway = swing * SHAPE.legStride;
  l(-SHAPE.legForward, 0.22, -SHAPE.legForward - 0.22 + legSway, 0.28, 0.16, 0.13, darkPrimary);
  l(-SHAPE.legForward, -0.22, -SHAPE.legForward - 0.22 - legSway, -0.28, 0.16, 0.13, darkPrimary);

  // ---- Torso: moves vertically with lurch ----
  g(lurch, 0, SHAPE.torsoForward, SHAPE.torsoSide, basePrimary);
  g(lurch - 0.08, 0, SHAPE.torsoForward - 0.08, SHAPE.torsoSide - 0.08, litPrimary); // lit side

  // ---- Arms: swing opposite the legs ----
  const armSwing = swing * 0.12;
  l(0.16, SHAPE.armSide, SHAPE.armForward + armSwing, SHAPE.armSide + 0.06, 0.17, 0.14, baseSecondary);
  l(0.16, -SHAPE.armSide, SHAPE.armForward - armSwing, -SHAPE.armSide - 0.06, 0.17, 0.14, baseSecondary);

  // ---- Head: small and centred ----
  g(SHAPE.headForward, 0, SHAPE.headRadius, SHAPE.headRadius - 0.04, basePrimary);

  // ---- Eyes: only saturated color, reads as facing direction ----
  g(SHAPE.headForward + 0.14, 0.08, 0.055, 0.055, "#ef4444");
  g(SHAPE.headForward + 0.14, -0.08, 0.055, 0.055, "#ef4444");
}

/**
 * Example: Boss Entity
 * A larger, more complex shape with phase-based scaling and special attacks.
 */

export const BOSS_SIZE = 48;
export const BOSS_DIRS = 8;
export const BOSS_FRAMES = 4;

interface BossShape {
  torsoForward: number;
  torsoSide: number;
  shoulderSide: number;
  shoulderRadius: number;
  headForward: number;
  headRadius: number;
  armForward: number;
  armSide: number;
  legForward: number;
  legStride: number;
}

const BOSS_SHAPE: BossShape = {
  torsoForward: 0.52,
  torsoSide: 0.62,
  shoulderSide: 0.60,
  shoulderRadius: 0.24,
  headForward: 0.42,
  headRadius: 0.22,
  armForward: 0.52,
  armSide: 0.66,
  legForward: -0.30,
  legStride: 0.14,
};

/**
 * Boss animation state can include combat state (idle, attacking, taking damage).
 */
export interface BossAnimState {
  dir: number;
  frame: number;
  phase: number; // 0, 1, or 2 (enrage phase) — affects size/speed visually
  state?: "idle" | "attacking" | "charge";
}

export function drawBoss(b: PixelBuf, state: BossAnimState, color: string): void {
  const C = BOSS_SIZE / 2;
  const U = C;
  const ax = axesFor(state.dir, BOSS_DIRS);

  const ramp = rampFrom(color);
  const bright = ramp[0];
  const lit = ramp[1];
  const base = ramp[2];
  const dark = ramp[3];

  // Animation: slightly slower walk at enrage phases (more aggressive)
  const phase = (state.frame / BOSS_FRAMES) * TAU;
  const swing = Math.sin(phase);
  const heave = Math.cos(phase * 0.5) * 0.05;

  const g = (f: number, s: number, rf: number, rs: number, col: string, offset = 0) =>
    blob(b, ax, f * U, (s + offset) * U, rf * U, rs * U, col, C, C);

  const l = (f0: number, s0: number, f1: number, s1: number, r0: number, r1: number, col: string) =>
    limb(b, ax, f0 * U, s0 * U, f1 * U, s1 * U, r0 * U, r1 * U, col, C, C);

  // ---- Legs: short and planted ----
  const legSway = swing * BOSS_SHAPE.legStride;
  l(-BOSS_SHAPE.legForward, 0.26, -BOSS_SHAPE.legForward - 0.22 + legSway, 0.30, 0.16, 0.13, dark);
  l(-BOSS_SHAPE.legForward, -0.26, -BOSS_SHAPE.legForward - 0.22 - legSway, -0.30, 0.16, 0.13, dark);

  // ---- Torso: massive slab ----
  g(heave, 0, BOSS_SHAPE.torsoForward, BOSS_SHAPE.torsoSide, base);
  g(heave, 0, BOSS_SHAPE.torsoForward - 0.12, BOSS_SHAPE.torsoSide - 0.12, lit); // lit side

  // ---- Shoulder pauldrons: set outside torso for wide silhouette ----
  g(0.10, BOSS_SHAPE.shoulderSide, BOSS_SHAPE.shoulderRadius, BOSS_SHAPE.shoulderRadius - 0.08, base);
  g(0.10, -BOSS_SHAPE.shoulderSide, BOSS_SHAPE.shoulderRadius, BOSS_SHAPE.shoulderRadius - 0.08, base);
  g(0.12, BOSS_SHAPE.shoulderSide, BOSS_SHAPE.shoulderRadius - 0.08, BOSS_SHAPE.shoulderRadius - 0.14, lit);
  g(0.12, -BOSS_SHAPE.shoulderSide, BOSS_SHAPE.shoulderRadius - 0.08, BOSS_SHAPE.shoulderRadius - 0.14, lit);

  // ---- Arms: swinging opposite legs ----
  const armSwing = swing * 0.10;
  l(0.16, BOSS_SHAPE.armSide, BOSS_SHAPE.armForward + armSwing, BOSS_SHAPE.armSide + 0.08, 0.17, 0.14, ramp[2]);
  l(0.16, -BOSS_SHAPE.armSide, BOSS_SHAPE.armForward - armSwing, -BOSS_SHAPE.armSide - 0.08, 0.17, 0.14, ramp[2]);

  // Fists
  g(BOSS_SHAPE.armForward + armSwing, BOSS_SHAPE.armSide - 0.04, 0.15, 0.15, dark);
  g(BOSS_SHAPE.armForward - armSwing, -BOSS_SHAPE.armSide + 0.04, 0.15, 0.15, dark);

  // ---- Armour banding across back ----
  for (const f of [-0.22, 0.02]) {
    l(f, 0.42, f, -0.42, 0.05, 0.05, dark);
  }

  // ---- Head: small, sunk between shoulders ----
  g(BOSS_SHAPE.headForward, 0, BOSS_SHAPE.headRadius, BOSS_SHAPE.headRadius - 0.04, ramp[2]);
  g(BOSS_SHAPE.headForward + 0.04, 0, BOSS_SHAPE.headRadius - 0.07, BOSS_SHAPE.headRadius - 0.10, lit);

  // ---- Eyes: red and menacing ----
  g(BOSS_SHAPE.headForward + 0.14, 0.09, 0.055, 0.055, "#ef4444");
  g(BOSS_SHAPE.headForward + 0.14, -0.09, 0.055, 0.055, "#ef4444");
}

/**
 * Integration example: sprite atlas caching.
 *
 * At startup, bake all entity variants into canvases:
 *
 *   const atlas = new Map<string, ImageData>();
 *   for (const type of ["common", "elite"]) {
 *     for (let dir = 0; dir < ENTITY_DIRS; dir++) {
 *       for (let frame = 0; frame < ENTITY_FRAMES; frame++) {
 *         const key = `${type}:${dir}:${frame}`;
 *         const buf = new PixelBuf(ENTITY_SIZE, ENTITY_SIZE);
 *         drawEntity(buf, type, { dir, frame, variant: 0 });
 *         atlas.set(key, buf);
 *       }
 *     }
 *   }
 *
 * Then in your game loop:
 *
 *   function render(entity: GameEntity, ctx: CanvasRenderingContext2D) {
 *     const dir = Math.floor((entity.heading / TAU) * ENTITY_DIRS) % ENTITY_DIRS;
 *     const frame = Math.floor((Date.now() / 100) % ENTITY_FRAMES);
 *     const key = `${entity.type}:${dir}:${frame}`;
 *     const imageData = atlas.get(key);
 *     if (imageData) ctx.putImageData(imageData, x, y);
 *   }
 */
