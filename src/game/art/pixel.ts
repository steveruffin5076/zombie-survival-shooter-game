/**
 * Pixel-art authoring primitives.
 *
 * Sprites are authored as plain RGBA buffers rather than canvases so they stay
 * pure data: no DOM, testable under vitest's `node` environment, and cheap to
 * build at startup. `cache.ts` owns the one place a buffer becomes a real
 * canvas — see `toCanvas()` there.
 *
 * Coordinates are ART pixels, not canvas units. One art pixel is blitted as
 * `PX_SCALE` canvas units with image smoothing off, which is what gives the
 * chunky look; nothing in this file knows or cares about that factor.
 */

/** Canvas units per art pixel. A 24x24 sprite occupies 48x48 world units. */
export const PX_SCALE = 2;

/** RGBA quad, 0-255. */
export type RGBA = readonly [number, number, number, number];

const HEX_CACHE = new Map<string, RGBA>();

/**
 * Parse `#rgb`, `#rrggbb` or `#rrggbbaa` into an RGBA quad. Memoized because
 * sprite authoring calls this for every pixel run and the palette is small.
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

/** A mutable RGBA pixel grid. All drawing clips silently at the edges. */
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
   * Write one pixel. Out-of-bounds writes are dropped rather than throwing —
   * sprite code offsets limbs by a swing amount and clipping at the sprite
   * edge is the expected behaviour, not a bug worth crashing on.
   *
   * Alpha < 255 composites over what's already there (source-over), so a
   * translucent grime pass reads as grime instead of punching a hole.
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
    // source-over against the existing pixel
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

  /** Filled axis-aligned block. */
  rect(x: number, y: number, w: number, h: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    const x0 = Math.round(x), y0 = Math.round(y);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) this.px(x0 + dx, y0 + dy, c);
    }
    return this;
  }

  /** Horizontal run, inclusive of both ends. */
  row(x0: number, x1: number, y: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    const a = Math.round(Math.min(x0, x1)), b = Math.round(Math.max(x0, x1));
    for (let x = a; x <= b; x++) this.px(x, y, c);
    return this;
  }

  /** Vertical run, inclusive of both ends. */
  col(x: number, y0: number, y1: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    const a = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    for (let y = a; y <= b; y++) this.px(x, y, c);
    return this;
  }

  /**
   * Filled ellipse, rasterized on the pixel grid. Top-down bodies are mostly
   * ovals, and stepping the grid keeps the edge chunky instead of smoothing it
   * the way a canvas `ellipse()` would.
   */
  oval(cx: number, cy: number, rx: number, ry: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    if (rx <= 0 || ry <= 0) return this;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.px(x, y, c);
      }
    }
    return this;
  }

  /** Straight line between two points (integer Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    let x = Math.round(x0), y = Math.round(y0);
    const xe = Math.round(x1), ye = Math.round(y1);
    const dx = Math.abs(xe - x), dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1, sy = y < ye ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x, y, c);
      if (x === xe && y === ye) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return this;
  }

  /** Read a pixel back as an RGBA quad. Mostly for tests. */
  get(x: number, y: number): RGBA {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (Math.round(y) * this.w + Math.round(x)) * 4;
    const d = this.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  /** True when nothing has been drawn — catches a sprite function that no-ops. */
  isEmpty(): boolean {
    const d = this.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
    return true;
  }

  /** Mirror the left half onto the right, for symmetric bodies. */
  mirrorX(): this {
    const half = Math.floor(this.w / 2);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < half; x++) {
        const src = (y * this.w + x) * 4;
        const dst = (y * this.w + (this.w - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) this.data[dst + k] = this.data[src + k];
      }
    }
    return this;
  }

  /**
   * Draw a 1px border in `color` around every opaque cluster, on the
   * transparent side. A dark outline is what separates a sprite from a dark
   * ground at gameplay speed — without it these read as mush.
   */
  outline(color: RGBA | string): this {
    const c = typeof color === "string" ? rgba(color) : color;
    // snapshot the alpha channel first: outlining in place would otherwise
    // let each new border pixel seed another border on the next column
    const solid = new Uint8Array(this.w * this.h);
    for (let i = 0; i < solid.length; i++) solid[i] = this.data[i * 4 + 3] > 0 ? 1 : 0;

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid[y * this.w + x]) continue;
        const n =
          (x > 0 && solid[y * this.w + x - 1]) ||
          (x < this.w - 1 && solid[y * this.w + x + 1]) ||
          (y > 0 && solid[(y - 1) * this.w + x]) ||
          (y < this.h - 1 && solid[(y + 1) * this.w + x]);
        if (n) this.px(x, y, c);
      }
    }
    return this;
  }
}
