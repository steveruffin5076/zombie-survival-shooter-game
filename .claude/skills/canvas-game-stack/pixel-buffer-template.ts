/**
 * Pixel Buffer Template
 *
 * Copy this file into your project as `src/game/art/pixel.ts` and adapt to your needs.
 * This is the foundation for all sprite authoring in the canvas-game-stack system.
 */

const TAU = Math.PI * 2;

/** Canvas units per art pixel. One art pixel is blitted as PX_SCALE canvas units. */
export const PX_SCALE = 2;

/** RGBA quad, 0-255. */
export type RGBA = readonly [number, number, number, number];

const HEX_CACHE = new Map<string, RGBA>();

/**
 * Parse `#rgb`, `#rrggbb` or `#rrggbbaa` into an RGBA quad.
 * Memoized because sprite authoring calls this heavily.
 */
export function rgba(hex: string): RGBA {
  const hit = HEX_CACHE.get(hex);
  if (hit) return hit;

  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 && h.length !== 8) {
    throw new Error(`pixel: bad color "${hex}" (want #rgb, #rrggbb or #rrggbbaa)`);
  }
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  const out: RGBA = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  HEX_CACHE.set(hex, out);
  return out;
}

/**
 * Mutable RGBA pixel grid. All drawing clips silently at the edges.
 * Out-of-bounds writes don't throw — sprite limbs swinging off-edge is expected.
 */
export class PixelBuf {
  readonly w: number;
  readonly h: number;
  /** RGBA, row-major, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    if (w < 1 || h < 1) throw new Error(`pixel: bad size ${w}x${h}`);
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /**
   * Write one pixel.
   *
   * Alpha < 255 composites source-over, so a translucent pass reads as blended.
   * Out-of-bounds writes are dropped (clipping).
   */
  px(x: number, y: number, color: RGBA | string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;

    const c = typeof color === "string" ? rgba(color) : color;
    const a = c[3];
    if (a === 0) return this;

    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (a === 255) {
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      return this;
    }
    // source-over composite
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return this;
    for (let k = 0; k < 3; k++) {
      d[i + k] = (c[k] * sa + d[i + k] * da * (1 - sa)) / oa;
    }
    d[i + 3] = oa * 255;
    return this;
  }

  /** Filled axis-aligned rectangle. */
  rect(x: number, y: number, w: number, h: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    const x0 = Math.round(x), y0 = Math.round(y);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) this.px(x0 + dx, y0 + dy, c);
    }
    return this;
  }

  /** Filled circle (or ellipse if rx != ry). */
  circle(x: number, y: number, rx: number, ry: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    const x0 = Math.round(x), y0 = Math.round(y);
    const rad = Math.max(rx, ry) + 1;
    for (let y = Math.floor(y0 - rad); y <= Math.ceil(y0 + rad); y++) {
      for (let x = Math.floor(x0 - rad); x <= Math.ceil(x0 + rad); x++) {
        const dx = x - x0, dy = y - y0;
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) this.px(x, y, c);
      }
    }
    return this;
  }
}

/**
 * Forward/side coordinate system for directional drawing.
 * The entity faces along the forward (fx, fy) vector;
 * its right side is along (sx, sy).
 */
export interface Axes {
  fx: number; fy: number;  // forward direction
  sx: number; sy: number;  // right side direction
}

/**
 * Compute axes for a given direction index.
 * dirs: number of directions (typically 8 or 16).
 */
export function axesFor(dir: number, dirs: number): Axes {
  const angle = (dir / dirs) * TAU;
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  return { fx, fy, sx: -fy, sy: fx };
}

/**
 * Filled ellipse in (forward, side) space, rotated to the entity's heading.
 *
 * @param ax axes (from axesFor)
 * @param fwd position along forward axis
 * @param side position along side axis
 * @param rf forward radius
 * @param rs side radius
 * @param cx, cy pixel grid center (default: image center)
 */
export function blob(
  b: PixelBuf, ax: Axes,
  fwd: number, side: number,
  rf: number, rs: number,
  color: string,
  cx = b.w / 2,
  cy = b.h / 2,
): void {
  const ox = cx + ax.fx * fwd + ax.sx * side;
  const oy = cy + ax.fy * fwd + ax.sy * side;
  const rad = Math.ceil(Math.max(rf, rs)) + 1;
  for (let y = Math.floor(oy - rad); y <= Math.ceil(oy + rad); y++) {
    for (let x = Math.floor(ox - rad); x <= Math.ceil(ox + rad); x++) {
      const dx = x - ox, dy = y - oy;
      // Project offset back onto forward/side axes
      const df = dx * ax.fx + dy * ax.fy;
      const ds = dx * ax.sx + dy * ax.sy;
      if ((df * df) / (rf * rf) + (ds * ds) / (rs * rs) <= 1) b.px(x, y, color);
    }
  }
}

/**
 * Tapered limb (line of shrinking blobs) from one (forward, side) point to another.
 * Connects body parts smoothly without hard edges.
 *
 * @param f0, s0 start point
 * @param f1, s1 end point
 * @param r0 radius at start
 * @param r1 radius at end
 */
export function limb(
  b: PixelBuf, ax: Axes,
  f0: number, s0: number,
  f1: number, s1: number,
  r0: number, r1: number,
  color: string,
  cx = b.w / 2,
  cy = b.h / 2,
): void {
  const steps = Math.max(2, Math.ceil(Math.hypot(f1 - f0, s1 - s0)));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const r = r0 + (r1 - r0) * k;
    blob(
      b, ax,
      f0 + (f1 - f0) * k,
      s0 + (s1 - s0) * k,
      r, r, color,
      cx, cy,
    );
  }
}

/**
 * Generate a 4-tone ramp from a single base color.
 * Used for lighting effects without needing per-entity color palettes.
 *
 * @param hex base color (e.g., "#8b5a3c" for skin)
 * @returns [bright, lit, base, dark] tones
 */
export function rampFrom(hex: string): [string, string, string, string] {
  const [r, g, b] = rgba(hex);
  const at = (m: number) => {
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * m)));
    return `#${[c(r), c(g), c(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  return [at(1.85), at(1.35), at(1), at(0.68)];
}
