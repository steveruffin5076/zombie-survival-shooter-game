/**
 * The blittable sprite atlas — the one place a pure `PixelBuf` becomes a
 * canvas the engine can `drawImage`.
 *
 * Every group is built on first use rather than all at once at construction:
 * a run only ever touches the weapon classes the player carries and the zombie
 * types that actually spawn, so building the full set up front would stall the
 * first frame for sprites most runs never show.
 *
 * The engine blits these with `imageSmoothingEnabled = false` — see
 * `Engine.resize`. Without that the browser bilinear-filters the upscale and
 * the pixel art turns to mush.
 */
import { PX_SCALE, PixelBuf } from "./pixel";
import {
  Z_POSES, buildGunBufs, buildSoldierBufs, buildZombieBufs, dirFor, poseIndex, zombieIndex,
} from "./sheets";
import { DIRS, FRAMES, GUN_SIZE, SOLDIER_SIZE } from "./sprites/soldier";
import { Z_DIRS, Z_FRAMES, Z_SIZE, Z_VARIANTS, type ZSpriteType } from "./sprites/zombies";
import { TILE_PX, TILE_VARIANTS, buildTileBufs, type GroundTheme } from "./sprites/tiles";
import { PROP_SIZE, buildPropBufs } from "./sprites/props";
import { BOSS_DIRS, BOSS_FRAMES, bossArtSize, drawBoss } from "./sprites/boss";
import type { WeaponClass } from "../weapons";

export { PX_SCALE, dirFor };
export { DIRS, FRAMES, SOLDIER_SIZE, GUN_SIZE } from "./sprites/soldier";
export { Z_DIRS, Z_FRAMES, Z_SIZE, Z_VARIANTS, type ZSpriteType } from "./sprites/zombies";
export { TILE_PX, TILE_VARIANTS, tileVariant, groundTheme, type GroundTheme } from "./sprites/tiles";
export { PROP_KINDS, PROP_VARIANTS, PROP_SIZE, WRECK_KIND } from "./sprites/props";
export { BOSS_DIRS, BOSS_FRAMES, bossArtSize } from "./sprites/boss";

/** Tile edge in CANVAS units — what the render loop steps by. */
export const TILE_UNITS = TILE_PX * PX_SCALE;

/** Turn one authored buffer into a canvas at 1:1 art-pixel scale. */
function toCanvas(buf: PixelBuf): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = buf.w;
  cv.height = buf.h;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("art: no 2d context for sprite canvas");
  // copy into a context-owned ImageData rather than wrapping the buffer:
  // `new ImageData(data, w, h)` demands a Uint8ClampedArray backed by a plain
  // ArrayBuffer, which PixelBuf's is not. One copy per sprite, built once.
  const img = ctx.createImageData(buf.w, buf.h);
  img.data.set(buf.data);
  ctx.putImageData(img, 0, 0);
  return cv;
}

export class SpriteAtlas {
  private soldierPoses: HTMLCanvasElement[] | null = null;
  private gunPoses = new Map<WeaponClass, HTMLCanvasElement[]>();
  private zombiePoses = new Map<ZSpriteType, HTMLCanvasElement[]>();
  private tileSets = new Map<GroundTheme, HTMLCanvasElement[]>();
  private propSets = new Map<number, HTMLCanvasElement[]>();
  private bossPoses = new Map<string, HTMLCanvasElement[]>();
  /** White silhouettes for hit flashes, keyed by the pose they mask. */
  private masks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
  /** Pre-rendered radial glows, keyed by color. */
  private glows = new Map<string, HTMLCanvasElement>();

  /** Cumulative milliseconds spent building sprites, surfaced under ?debug=1. */
  buildMs = 0;

  private timed<T>(fn: () => T): T {
    const t0 = performance.now();
    const out = fn();
    this.buildMs += performance.now() - t0;
    return out;
  }

  /** Player body for a facing + walk frame. Pass frame -1 for the idle pose. */
  soldier(dir: number, frame: number): HTMLCanvasElement {
    if (!this.soldierPoses) {
      this.soldierPoses = this.timed(() => buildSoldierBufs().map(toCanvas));
    }
    const f = frame < 0 ? 0 : frame % FRAMES;
    return this.soldierPoses[poseIndex(dir % DIRS, f, FRAMES)];
  }

  /** Held weapon for a facing. */
  gun(cls: WeaponClass, dir: number): HTMLCanvasElement {
    let poses = this.gunPoses.get(cls);
    if (!poses) {
      poses = this.timed(() => buildGunBufs(cls).map(toCanvas));
      this.gunPoses.set(cls, poses);
    }
    return poses[dir % DIRS];
  }

  /** Zombie body for a type + variant + facing + shamble frame. */
  zombie(type: ZSpriteType, variant: number, dir: number, frame: number): HTMLCanvasElement {
    let poses = this.zombiePoses.get(type);
    if (!poses) {
      poses = this.timed(() => buildZombieBufs(type).map(toCanvas));
      this.zombiePoses.set(type, poses);
    }
    const i = zombieIndex(variant % Z_VARIANTS, dir % Z_DIRS, frame % Z_FRAMES);
    return poses[i];
  }

  /**
   * One ground tile variant. Built per theme on first use — a run only ever
   * stands on the themes its stages actually use.
   */
  tile(theme: GroundTheme, variant: number): HTMLCanvasElement {
    let set = this.tileSets.get(theme);
    if (!set) {
      set = this.timed(() => buildTileBufs(theme).map(toCanvas));
      this.tileSets.set(theme, set);
    }
    return set[variant % TILE_VARIANTS];
  }

  /**
   * Boss body for a facing + stomp frame. Keyed by the boss's id so two bosses
   * sharing a colour still get their own set, and built on first use — a run
   * only ever meets the bosses its stages actually spawn.
   */
  boss(defId: string, color: string, r: number, dir: number, frame: number): HTMLCanvasElement {
    let poses = this.bossPoses.get(defId);
    if (!poses) {
      poses = this.timed(() => {
        const size = bossArtSize(r);
        const out: HTMLCanvasElement[] = [];
        for (let d = 0; d < BOSS_DIRS; d++) {
          for (let f = 0; f < BOSS_FRAMES; f++) {
            const buf = new PixelBuf(size, size);
            drawBoss(buf, d, f, color);
            buf.outline("#07090c");
            out.push(toCanvas(buf));
          }
        }
        return out;
      });
      this.bossPoses.set(defId, poses);
    }
    return poses[(dir % BOSS_DIRS) * BOSS_FRAMES + (frame % BOSS_FRAMES)];
  }

  /** One decor prop variant, built per kind on first use. */
  prop(kind: number, variant: number): HTMLCanvasElement {
    let set = this.propSets.get(kind);
    if (!set) {
      set = this.timed(() => buildPropBufs(kind).map(toCanvas));
      this.propSets.set(kind, set);
    }
    // modulo the built set, not PROP_VARIANTS: the stage wreck has one entry
    // per theme rather than three cosmetic variants
    return set[variant % set.length];
  }

  /** Half-extent of a prop sprite in CANVAS units, as [halfW, halfH]. */
  propHalf(kind: number): readonly [number, number] {
    const [w, h] = PROP_SIZE[kind];
    return [(w * PX_SCALE) / 2, (h * PX_SCALE) / 2];
  }

  /**
   * A white silhouette of a sprite, for hit flashes.
   *
   * The obvious way to flash a sprite is `ctx.filter = "brightness(0) invert(1)"`
   * before re-blitting it, but `ctx.filter` is re-parsed and re-applied per call
   * and measurably drops the frame rate once a crowd is taking fire. Baking the
   * mask once per pose and blitting it is a plain `drawImage`.
   */
  mask(spr: HTMLCanvasElement): HTMLCanvasElement {
    let m = this.masks.get(spr);
    if (m) return m;
    m = this.timed(() => {
      const cv = document.createElement("canvas");
      cv.width = spr.width;
      cv.height = spr.height;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("art: no 2d context for flash mask");
      ctx.drawImage(spr, 0, 0);
      // keep the sprite's alpha, replace every color with white
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cv.width, cv.height);
      return cv;
    });
    this.masks.set(spr, m);
    return m;
  }

  /**
   * A soft radial glow of one color, built once and blitted wherever a light
   * pool is needed. `createRadialGradient` allocates a new gradient object on
   * every call, so doing it per entity per frame is the kind of cost that only
   * shows up once there are forty of them on screen.
   */
  glow(color: string): HTMLCanvasElement {
    let g = this.glows.get(color);
    if (g) return g;
    g = this.timed(() => {
      const R = 64;
      const cv = document.createElement("canvas");
      cv.width = cv.height = R * 2;
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("art: no 2d context for glow");
      const gr = ctx.createRadialGradient(R, R, 1, R, R, R);
      gr.addColorStop(0, color);
      gr.addColorStop(1, "transparent");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, R * 2, R * 2);
      return cv;
    });
    this.glows.set(color, g);
    return g;
  }

  /** Half-width of a zombie sprite in CANVAS units — the blit offset. */
  zombieHalf(type: ZSpriteType): number {
    return (Z_SIZE[type] * PX_SCALE) / 2;
  }

  /** Poses per zombie type, for sizing/debug reporting. */
  static readonly zombiePoseCount = Z_POSES;
}

/** Half-width of a player body sprite, in canvas units. */
export const SOLDIER_HALF = (SOLDIER_SIZE * PX_SCALE) / 2;
/** Half-width of a weapon sprite, in canvas units. */
export const GUN_HALF = (GUN_SIZE * PX_SCALE) / 2;
