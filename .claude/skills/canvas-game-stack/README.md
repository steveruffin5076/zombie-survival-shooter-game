# Canvas Game Stack: Pixel-Buffer Graphics System

A reusable pattern for authoring top-down, pixel-art game sprites using pure data (RGBA buffers) rather than canvas rendering.

## Overview

This system enables sprite authoring that is:
- **Pure data** — no DOM, testable under Node.js, cheap to build at startup
- **Rotation-friendly** — pixels stay axis-aligned at every direction (no canvas rotation artifacts)
- **Animation-capable** — frame cycling and directional facing are first-class concepts
- **Reusable** — the same primitives (`blob`, `limb`, color ramps) work across all entity types

## Core Architecture

### 1. PixelBuf: Mutable RGBA Grid

A `PixelBuf` is a mutable pixel grid storing raw RGBA data.

```typescript
class PixelBuf {
  w: number;      // width in art pixels
  h: number;      // height in art pixels
  data: Uint8ClampedArray;  // RGBA, row-major, 4 bytes/pixel

  px(x: number, y: number, color: RGBA | string): this
  rect(x: number, y: number, w: number, h: number, color: RGBA | string): this
}
```

**Key properties:**
- Out-of-bounds writes clip silently (sprite limbs swing off-edge without crashing)
- Alpha composites source-over (translucent pixels blend; alpha=0 is no-op)
- One art pixel = `PX_SCALE` canvas units (chunky retro look)

### 2. Coordinate System: Forward/Side Space

All drawing happens in **(forward, side)** coordinates relative to the entity's heading:
- **Forward (f)**: direction the entity faces
- **Side (s)**: 90° to the right of forward

This allows the same body shape to be rasterized at any facing without rotating a finished bitmap.

### 3. Axes: Unit Vectors for Orientation

```typescript
interface Axes {
  fx: number, fy: number;  // unit vector along heading
  sx: number, sy: number;  // unit vector 90° right
}

function axesFor(dir: number, dirs: number): Axes
```

Compute axes once per sprite, then use them to place all parts at the current facing.

### 4. Blob: Filled Oval in Forward/Side Space

```typescript
function blob(
  b: PixelBuf, ax: Axes,
  fwd: number, side: number,          // position in (forward, side)
  rf: number, rs: number,             // forward & side radii
  color: string,
  cx?: number, cy?: number            // pixel grid center (default image center)
): void
```

Draws a filled ellipse that naturally stays wider across the shoulders than front-to-back at every angle. Proportions stay consistent as the entity rotates.

### 5. Limb: Tapered Limb Between Two Points

```typescript
function limb(
  b: PixelBuf, ax: Axes,
  f0: number, s0: number, f1: number, s1: number,  // start and end (forward, side)
  r0: number, r1: number,                           // radii at start and end
  color: string,
  cx?: number, cy?: number
): void
```

A tapered line made of shrinking blobs — connects two body parts with a smooth taper. Used for arms, legs, and connecting segments.

### 6. Color Ramps: Lighting & Variation

Base body color is shaded into lighter and darker tones using a **ramp function**:

```typescript
function rampFrom(hex: string): [string, string, string, string] {
  // Returns [bright, lit, base, dark]
  // All derived from a single hex color via brightness multipliers
}
```

This allows a new entity type to require only one base color; lighting tones are derived automatically.

---

## Animation Pattern

### Facing

Entities are pre-baked at multiple facing directions (typically 8 or 16):

```typescript
export const DIRS = 8;  // number of directions to bake
export const FRAMES = 4;  // walk/shamble cycle frames per direction
```

For each direction: `dir = heading / (TAU / DIRS)`

### Frame Cycling

Frame drives locomotion phase (walk, shamble, or stomp cycle):

```typescript
const phase = (frame / FRAMES) * TAU;
const swing = Math.sin(phase);      // limb swing
const lurch = Math.cos(phase * 0.5); // body bob
```

- Each frame represents one step in the cycle
- Use `Math.sin()` for limb opposition (left leg forward when right arm back)
- Use `Math.cos()` with a slower frequency for body vertical bob

### Multi-Variant Animation

When a crowd uses the same frame sequence, they move in lockstep. Break this with **variants**:

```typescript
const variant = 0 | 1 | 2;  // pick a variant
const offset = variant * (TAU / numVariants);
const phase = ((frame / FRAMES) * TAU) + offset;
```

Each variant has a different phase offset so a crowd has natural rhythm variation.

---

## Entity Drawing: Full Example

### Layout: Player/Soldier

```typescript
// Dimensions
export const SOLDIER_SIZE = 24;  // art pixels
export const DIRS = 16;          // facing directions
export const FRAMES = 4;         // walk cycle frames

export function drawPlayer(
  b: PixelBuf, dir: number, frame: number,
): void {
  const C = SOLDIER_SIZE / 2;
  const U = C;
  const ax = axesFor(dir, DIRS);

  // Lighting
  const ramp = rampFrom("#cc8844");  // base skin tone
  const primary = ramp[1];    // lit side
  const secondary = ramp[2];  // base color
  const dark = ramp[3];       // shadowed side

  // Animation phase
  const phase = (frame / FRAMES) * TAU;
  const swing = Math.sin(phase);
  const heave = Math.cos(phase * 0.5) * 0.08;

  // Legs: sway left/right with walk phase
  const legSway = swing * 0.14;
  limb(b, ax, -0.30, 0.22, -0.52 + legSway, 0.28, 0.14, 0.12, dark, C, C);
  limb(b, ax, -0.30, -0.22, -0.52 - legSway, -0.28, 0.14, 0.12, dark, C, C);

  // Torso: vertical bob with half-frequency
  blob(b, ax, heave, 0, 0.48, 0.56, secondary, C, C);

  // Arms: swing opposite legs
  const armSwing = swing * 0.12;
  limb(b, ax, 0.14, 0.62, 0.44 + armSwing, 0.54, 0.16, 0.13, secondary, C, C);
  limb(b, ax, 0.14, -0.62, 0.44 - armSwing, -0.54, 0.16, 0.13, secondary, C, C);

  // Head
  blob(b, ax, 0.40, 0, 0.20, 0.18, primary, C, C);

  // Eyes (only saturated color, reads as facing direction)
  blob(b, ax, 0.54, 0.08, 0.05, 0.05, "#ef4444", C, C);
  blob(b, ax, 0.54, -0.08, 0.05, 0.05, "#ef4444", C, C);
}
```

### Layout: Enemy (Zombie)

Similar structure, with type-specific proportions:

```typescript
export type ZSpriteType = "walker" | "runner" | "brute" | "spitter" | "screamer";

export const Z_DIRS = 8;    // turn slower than player
export const Z_FRAMES = 4;  // shamble cycle
export const Z_SIZE: Record<ZSpriteType, number> = {
  walker: 24, runner: 18, spitter: 20, brute: 52, screamer: 18
};

const SHAPES: Record<ZSpriteType, Shape> = {
  walker: { rf: 0.42, rs: 0.50, headF: 0.30, ... },
  runner: { rf: 0.46, rs: 0.40, headF: 0.42, ... },
  brute: { rf: 0.44, rs: 0.68, headF: 0.20, ... },
  // ... etc
};

export function drawZombie(
  b: PixelBuf, type: ZSpriteType, dir: number, frame: number, variant: number,
): void {
  const size = Z_SIZE[type];
  const C = size / 2;
  const U = C;
  const ax = axesFor(dir, Z_DIRS);
  const sh = SHAPES[type];
  const { flesh, cloth } = ZOMBIE_RAMPS[type];

  // Variant phase offset so a crowd doesn't move in lockstep
  const phase = (frame / Z_FRAMES) * TAU;
  const offset = variant ? Math.PI * 0.5 : 0;
  const swing = Math.sin(phase + offset);
  const lurch = Math.cos((phase + offset) * 0.5) * 0.4;

  // Draw all parts using the shape proportions
  limb(b, ax, -0.30 + lurch, 0.22, -0.52 - 0.14 * swing, 0.30, 0.16, 0.13, flesh, C, C);
  limb(b, ax, -0.30 + lurch, -0.22, -0.52 + 0.14 * swing, -0.30, 0.16, 0.13, flesh, C, C);

  blob(b, ax, lurch, 0, sh.rf * U, sh.rs * U, flesh, C, C);

  // ... arms, head, etc.
}
```

---

## Quick-Start: Adding a New Entity Type

1. **Define size and animation constants:**
   ```typescript
   export const MY_SIZE = 32;
   export const MY_DIRS = 8;
   export const MY_FRAMES = 4;
   ```

2. **Create a shape template** (proportions as fractions of half-size):
   ```typescript
   const SHAPE = {
     rf: 0.40, rs: 0.50,      // torso radii
     headF: 0.25, headR: 0.20, // head offset and radius
     armF: 0.60, armS: 0.40,   // arm reach and spread
     legF: -0.50, stride: 0.15, // leg offset and step amplitude
   };
   ```

3. **Define a drawing function** that:
   - Takes `PixelBuf`, `dir`, `frame`, and entity-specific params
   - Computes `Axes`, `phase`, animation parameters
   - Calls `blob()` and `limb()` with proportions from SHAPE
   - Uses color ramps for lighting

4. **Bake into a sprite atlas** (if using many sprites):
   - Loop over all directions and frames
   - Call your drawing function for each combo
   - Cache as canvases (see `cache.ts` for integration)

---

## Color and Lighting

### Single-Color Ramps

```typescript
function rampFrom(hex: string): [string, string, string, string] {
  const [r, g, b] = rgba(hex);
  const brighten = (m: number) => /* multiply each channel by m */;
  return [
    brighten(1.85),  // bright lit side
    brighten(1.35),  // lit mid-tone
    brighten(1.00),  // base color
    brighten(0.68),  // dark shadowed side
  ];
}
```

A single dark hex produces four shades. Lighting is fixed in screen space (light always from upper-left) and does not rotate with the entity.

### Per-Type Palettes

Different entity types can have different ramp definitions:

```typescript
export const ZOMBIE_RAMPS: Record<ZSpriteType, { flesh: string, cloth: string }> = {
  walker: { flesh: "#8b5a3c", cloth: "#3a3a3a" },
  brute: { flesh: "#5a4a3a", cloth: "#2a2a2a" },
  // ...
};
```

---

## Integration Points

### 1. Canvas Rendering

`PixelBuf.data` is an RGBA `Uint8ClampedArray`. Convert to canvas:

```typescript
const imageData = new ImageData(buf.data, buf.w, buf.h);
ctx.putImageData(imageData, x, y);
```

Or scale with crisp pixel art look:

```typescript
ctx.imageSmoothingEnabled = false;
ctx.drawImage(canvas, x, y, buf.w * PX_SCALE, buf.h * PX_SCALE);
```

### 2. Sprite Caching

Bake all directions and frames at startup, store as canvases. For a 16-direction, 4-frame sprite:
- Player: 16 × 4 = 64 canvases
- Zombie types: 8 × 4 × 2 variants = up to 640 canvases (5 types)
- Bosses: 8 × 4 = 32 canvases per boss type

Use a sprite atlas or cache object to look up `spriteFor(type, dir, frame, variant)`.

### 3. Game Engine Loop

```typescript
const dir = Math.floor((entity.heading / TAU) * DIRS);
const frame = Math.floor((animTime / frameTime) % FRAMES);
const sprite = cache.get(entity.type, dir, frame);
ctx.drawImage(sprite, screenX - size/2, screenY - size/2);
```

---

## File Structure (Reference)

This implementation pattern is used across:

- **`src/game/art/pixel.ts`** — `PixelBuf`, `rgba()` color parsing
- **`src/game/art/sprites/soldier.ts`** — `axesFor()`, `blob()`, `limb()`, `drawPlayer()`
- **`src/game/art/sprites/zombies.ts`** — `drawZombie()` for all 5 types
- **`src/game/art/sprites/boss.ts`** — `drawBoss()` with ramp-derived color palette
- **`src/game/art/cache.ts`** — sprite atlas baking and canvas caching
- **`src/game/art/palette.ts`** — color constants and ramp definitions

---

## Performance Notes

- **Data-only:** Buffers don't require the DOM; they're testable and can be pre-computed.
- **Startup cost:** Baking a full sprite atlas at startup is cheap (milliseconds).
- **Runtime cost:** Drawing happens at 60 FPS; pixel operations are fast (no canvas rotation).
- **Memory:** One 32×32 sprite = 4,096 pixels × 4 bytes = 16 KB. A 16-direction, 4-frame, 2-variant entity ≈ 2 MB. Compress with canvas caching if needed.

---

## Further Reading

- **Pixel art fundamentals:** Proportions and silhouette are more important than detail at gameplay scale.
- **Animation:** Small phase offsets between variants prevent crowd synchronization.
- **Lighting:** Fixed light source (not rotating with the entity) prevents the visual impression that the world is tilting.
- **Reusable primitives:** `blob()` and `limb()` are enough to describe humanoid, monster, and vehicle shapes.
