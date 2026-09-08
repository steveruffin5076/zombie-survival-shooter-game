import { UPGRADES, type UpgradeDef } from "./upgrades";
import { Sfx } from "./audio";
import type { EngineEvent, GameStats, HudState, UpgradeChoice } from "./types";

/* ------------------------------------------------------------------ */
/* constants + helpers                                                 */
/* ------------------------------------------------------------------ */

const W = 1280;
const H = 720;
const WORLD_W = 2880;
const GROUND = 584;
const GRAV = 2400;
const TAU = Math.PI * 2;

const R = (a: number, b: number) => a + Math.random() * (b - a);
const RI = (a: number, b: number) => Math.floor(R(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const chance = (p: number) => Math.random() < p;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type ZType = "walker" | "runner" | "brute" | "spitter";

interface ZConf {
  hp: number; speed: number; dmg: number; r: number; scale: number; xp: number; score: number;
}

const ZCONF: Record<ZType, ZConf> = {
  walker: { hp: 34, speed: 52, dmg: 9, r: 19, scale: 1, xp: 1, score: 10 },
  runner: { hp: 20, speed: 128, dmg: 7, r: 15, scale: 0.88, xp: 2, score: 14 },
  spitter: { hp: 30, speed: 46, dmg: 8, r: 16, scale: 0.95, xp: 2, score: 22 },
  brute: { hp: 150, speed: 36, dmg: 22, r: 30, scale: 1.5, xp: 6, score: 45 },
};

const WEAPONS = [
  "Rusty Revolver",
  "Scrap SMG",
  "Tactical Carbine",
  "Storm Rifle",
  "Hellfire Repeater",
  "Dawnbringer Engine",
];
const TIER_PTS = [2, 4, 7, 10, 13];

const WAVE_SUBS = [
  "they smell your blood",
  "hold the line",
  "the horde thickens",
  "no mercy",
  "they just keep coming",
  "stay in the light",
];

const SKIN = ["#7a8f66", "#6d8560", "#87976b", "#5f7a55"];
const CLOTH = ["#2a3040", "#33272b", "#24303a", "#3a3230"];
const BLOOD = ["#7f1d1d", "#991b1b", "#b91c1c", "#5f1118"];

interface Zombie {
  x: number; y: number; vx: number;
  hp: number; maxHp: number; speed: number; dmg: number; r: number; scale: number;
  type: ZType; xp: number; score: number;
  t: number; atk: number; flash: number; face: number; dead: boolean; spit: number;
  tint: number; boss: boolean; wob: number;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; pierce: number; crit: boolean; life: number;
  hits: Set<Zombie>;
}

interface EShot { x: number; y: number; vx: number; vy: number; dmg: number; life: number }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; grav: number; add: boolean;
}

interface Gem { x: number; y: number; vx: number; vy: number; val: number; t: number; rest: boolean }
interface FloatText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number }
interface Decal { x: number; s: number; a: number }
interface SpawnItem { type: ZType; boss?: boolean }
interface Banner { text: string; sub: string; t: number; dur: number }
interface Building { x: number; w: number; h: number; win: number }
interface Decor { x: number; kind: number; s: number; ph: number } // kind 0 stone-a 1 stone-b 2 tree 3 lamp
interface Star { x: number; y: number; r: number; ph: number; tw: number }

/* ------------------------------------------------------------------ */
/* engine                                                              */
/* ------------------------------------------------------------------ */

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onEvent: (e: EngineEvent) => void;
  readonly sfx = new Sfx();

  private raf = 0;
  private last = 0;
  private tGlobal = 0;

  mode: "attract" | "play" = "attract";
  private over = false;
  private paused = false;
  private modalOpen = false;

  private keys = new Set<string>();
  private mouse = { x: W / 2, y: 300, down: false };

  // world state
  private cam = 0;
  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;

  private pl = this.freshPlayer();
  private st = this.baseStats();
  private stacks: Record<string, number> = {};
  private tier = 1;

  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private eshots: EShot[] = [];
  private particles: Particle[] = [];
  private gems: Gem[] = [];
  private texts: FloatText[] = [];
  private decals: Decal[] = [];

  private wave = 0;
  private phase: "break" | "active" = "break";
  private breakT = 0;
  private spawnT = 0;
  private queue: SpawnItem[] = [];
  private waveTotal = 0;

  private score = 0;
  private kills = 0;
  private playTime = 0;
  private lvlPending = 0;
  private banners: Banner[] = [];
  private ambientT = 0;
  private moteT = 0;
  private high = 0;

  // decor
  private stars: Star[] = [];
  private skyFar: Building[] = [];
  private skyNear: Building[] = [];
  private decor: Decor[] = [];
  private tufts: { x: number; h: number; s: number }[] = [];

  constructor(canvas: HTMLCanvasElement, onEvent: (e: EngineEvent) => void) {
    this.canvas = canvas;
    this.onEvent = onEvent;
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.high = Number(localStorage.getItem("graveyard-shift-high") || 0);
    this.genDecor();
    this.reset();
    this.cam = 0; // attract mode frames the world edge as a backdrop
    this.bind();
  }

  /* ---------------- lifecycle ---------------- */

  begin() {
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      let dt = (now - this.last) / 1000;
      this.last = now;
      dt = Math.min(dt, 1 / 30);
      this.tGlobal += dt;
      if (this.mode === "attract") this.updateAttract(dt);
      else if (!this.paused && !this.modalOpen && !this.over) this.update(dt);
      this.updateBanner(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVis);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
  }

  startGame() {
    this.sfx.ensure();
    this.reset();
    this.mode = "play";
    this.phase = "break";
    this.breakT = 1.6;
    this.announce("GRAVEYARD SHIFT", "survive the night", 2.4);
  }

  toMenu() {
    this.reset();
    this.mode = "attract";
    this.cam = 0;
  }

  togglePause() {
    if (this.mode !== "play" || this.over || this.modalOpen) return;
    this.paused = !this.paused;
    this.onEvent({ type: "pause", value: this.paused });
  }

  setPaused(v: boolean) {
    if (this.mode !== "play" || this.over) return;
    this.paused = v;
    this.onEvent({ type: "pause", value: v });
  }

  toggleMute() {
    this.sfx.ensure();
    this.sfx.muted = !this.sfx.muted;
    this.sfx.click();
  }

  /* ---------------- setup ---------------- */

  private freshPlayer() {
    return {
      x: WORLD_W / 2, y: GROUND, vx: 0, vy: 0,
      hp: 100, level: 1, xp: 0, xpNext: 12,
      face: 1, aim: 0, cd: 0, ifr: 0, flash: 0, hurtT: 0,
      dashT: 0, dashCd: 0, dashDir: 1,
      jumps: 0, grounded: true, walk: 0,
    };
  }

  private baseStats() {
    return {
      damage: 13, fireRate: 3.1, bulletSpeed: 800, jitter: 0.02,
      projectiles: 1, pierce: 0, crit: 0.05,
      speed: 275, maxHp: 100, magnet: 1, lifesteal: 0, regen: 0, dashMax: 2.3,
    };
  }

  private reset() {
    this.pl = this.freshPlayer();
    this.st = this.baseStats();
    this.stacks = {};
    this.tier = 1;
    this.zombies = [];
    this.bullets = [];
    this.eshots = [];
    this.particles = [];
    this.gems = [];
    this.texts = [];
    this.decals = [];
    this.wave = 0;
    this.waveTotal = 0;
    this.queue = [];
    this.score = 0;
    this.kills = 0;
    this.playTime = 0;
    this.lvlPending = 0;
    this.banners = [];
    this.over = false;
    this.paused = false;
    this.modalOpen = false;
    this.cam = clamp(this.pl.x - W / 2, 0, WORLD_W - W);
    this.mouse.x = W / 2;
    this.mouse.y = 280;
    this.mouse.down = false;
  }

  private genDecor() {
    // stars
    for (let i = 0; i < 110; i++)
      this.stars.push({ x: R(-40, W + 120), y: R(0, 420), r: R(0.6, 1.8), ph: R(0, TAU), tw: R(0.5, 2.4) });
    // skylines
    const gen = (p: number, minH: number, maxH: number, minW: number, maxW: number) => {
      const arr: Building[] = [];
      const span = W + (WORLD_W - W) * p + 400;
      let x = -120;
      while (x < span) {
        const w = R(minW, maxW);
        arr.push({ x, w, h: R(minH, maxH), win: R(0, 1) });
        x += w + R(6, 40);
      }
      return arr;
    };
    this.skyFar = gen(0.18, 60, 200, 46, 110);
    this.skyNear = gen(0.38, 40, 150, 30, 80);
    // graveyard decor at parallax .68
    const span = W + (WORLD_W - W) * 0.68 + 500;
    let dx = -160;
    while (dx < span) {
      const roll = Math.random();
      const kind = roll < 0.42 ? RI(0, 1) : roll < 0.78 ? 2 : 3;
      this.decor.push({ x: dx, kind, s: R(0.7, 1.25), ph: R(0, TAU) });
      dx += R(120, 300);
    }
    // ground tufts (world coords, parallax 1)
    let tx = -60;
    while (tx < WORLD_W + 120) {
      this.tufts.push({ x: tx, h: R(5, 14), s: R(0.6, 1.3) });
      tx += R(40, 120);
    }
  }

  /* ---------------- input ---------------- */

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(c)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(c);
    this.sfx.ensure();
    if (this.mode !== "play" || this.over) return;
    if (c === "Escape" || c === "KeyP") {
      this.togglePause();
      return;
    }
    if (this.paused || this.modalOpen) return;
    if (c === "Space" || c === "KeyW" || c === "ArrowUp") this.jump();
    if (c === "ShiftLeft" || c === "ShiftRight") this.dash();
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onBlur = () => {
    this.keys.clear();
    this.mouse.down = false;
  };

  private onVis = () => {
    if (document.hidden && this.mode === "play" && !this.over && !this.modalOpen && !this.paused)
      this.setPaused(true);
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * W;
    this.mouse.y = ((e.clientY - rect.top) / rect.height) * H;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.sfx.ensure();
    this.mouse.down = true;
  };

  private onMouseUp = () => (this.mouse.down = false);
  private onCtx = (e: Event) => e.preventDefault();

  private bind() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVis);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("contextmenu", this.onCtx);
  }

  private inputDir() {
    const r = this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0;
    const l = this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0;
    return r - l;
  }

  private jump() {
    const p = this.pl;
    if (p.jumps >= 2) return;
    p.vy = -870;
    p.jumps++;
    p.grounded = false;
    this.sfx.jump();
    for (let i = 0; i < 5; i++)
      this.particles.push({ x: p.x + R(-8, 8), y: GROUND + 2, vx: R(-50, 50), vy: R(-40, -10), life: 0.4, max: 0.4, size: R(2, 4), color: "#3a4552", grav: 300, add: false });
  }

  private dash() {
    const p = this.pl;
    if (p.dashCd > 0) return;
    const stDash = this.stacks["dash"] || 0;
    p.dashCd = this.st.dashMax;
    p.dashT = 0.16 + 0.06 * stDash;
    p.dashDir = this.inputDir() || p.face;
    p.vy = Math.min(p.vy, 30);
    this.sfx.dash();
  }

  /* ---------------- attract (menu bg) ---------------- */

  private updateAttract(dt: number) {
    this.ambientT -= dt;
    if (this.ambientT <= 0 && this.zombies.length < 7) {
      this.ambientT = R(1.2, 2.6);
      const fromLeft = chance(0.5);
      const type: ZType = chance(0.72) ? "walker" : chance(0.5) ? "runner" : "brute";
      const c = ZCONF[type];
      const z = this.mkZombie(type, fromLeft ? -60 : W + 60, 1, 1);
      z.vx = (fromLeft ? 1 : -1) * c.speed * R(0.35, 0.6);
      this.zombies.push(z);
    }
    for (const z of this.zombies) {
      z.t += dt;
      z.x += z.vx * dt;
      z.face = z.vx >= 0 ? 1 : -1;
    }
    this.zombies = this.zombies.filter((z) => z.x > -120 && z.x < W + 120);
    this.updateParticles(dt);
    this.motes(dt);
  }

  private motes(dt: number) {
    this.moteT -= dt;
    if (this.moteT <= 0 && this.particles.length < 320) {
      this.moteT = 0.35;
      this.particles.push({
        x: this.cam + R(0, W), y: R(120, GROUND - 40),
        vx: R(-6, 6), vy: R(-8, -2),
        life: R(3, 6), max: 6, size: R(1, 2.2),
        color: "#fbbf24", grav: -2, add: true,
      });
    }
  }

  /* ---------------- core update ---------------- */

  private update(dt: number) {
    const p = this.pl;
    this.playTime += dt;
    this.motes(dt);

    // timers
    p.cd -= dt; p.ifr -= dt; p.hurtT -= dt; p.flash -= dt; p.dashCd -= dt;

    // horizontal
    const mov = this.inputDir();
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir * 1350;
      this.particles.push({ x: p.x - p.dashDir * 10, y: p.y - 34, vx: -p.dashDir * R(30, 90), vy: R(-30, 30), life: 0.3, max: 0.3, size: R(4, 10), color: "#67e8f9", grav: 0, add: true });
    } else {
      const target = mov * this.st.speed;
      const rate = p.grounded ? 14 : 7;
      p.vx = lerp(p.vx, target, Math.min(1, rate * dt));
    }

    // vertical
    p.vy += GRAV * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND) {
      if (!p.grounded && p.vy > 300) {
        for (let i = 0; i < 6; i++)
          this.particles.push({ x: p.x + R(-10, 10), y: GROUND + 2, vx: R(-70, 70), vy: R(-50, -12), life: 0.35, max: 0.35, size: R(2, 4), color: "#3a4552", grav: 320, add: false });
      }
      p.y = GROUND; p.vy = 0; p.grounded = true; p.jumps = 0;
    }
    p.x = clamp(p.x + p.vx * dt, 26, WORLD_W - 26);

    const run = Math.abs(p.vx) > 26 && p.grounded;
    p.walk += dt * (run ? 10 + Math.abs(p.vx) * 0.014 : 3);

    // aim
    const mxw = this.mouse.x + this.cam;
    p.aim = Math.atan2(this.mouse.y - (p.y - 40), mxw - p.x);
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;

    // fire
    if (this.mouse.down && p.cd <= 0) this.fire();

    // regen
    if (this.st.regen > 0) p.hp = Math.min(this.st.maxHp, p.hp + this.st.regen * dt);

    // waves
    if (this.phase === "break") {
      this.breakT -= dt;
      if (this.breakT <= 0) this.startWave(this.wave + 1);
    } else {
      this.spawnT -= dt;
      const cap = Math.min(26, 8 + this.wave);
      if (this.spawnT <= 0 && this.queue.length > 0 && this.zombies.length < cap) {
        this.spawnT = Math.max(0.3, 1.5 - this.wave * 0.07);
        const n = this.wave >= 6 && this.queue.length > 2 && chance(0.4) ? 2 : 1;
        for (let i = 0; i < n && this.queue.length > 0; i++) this.spawnZombie(this.queue.shift()!);
      }
      if (this.queue.length === 0 && this.zombies.length === 0) {
        this.phase = "break";
        this.breakT = 3.4;
        this.score += 50 * this.wave;
        p.hp = Math.min(this.st.maxHp, p.hp + 12);
        this.announce(`WAVE ${this.wave} CLEARED`, `+${50 * this.wave} score — breathe while you can`);
      }
    }

    this.updateZombies(dt);
    this.updateBullets(dt);
    this.updateEshots(dt);
    this.updateGems(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);

    // decals fade
    for (const d of this.decals) d.a -= dt * 0.02;
    this.decals = this.decals.filter((d) => d.a > 0.05);

    // camera
    const target = clamp(p.x - W / 2 + Math.cos(p.aim) * 60, 0, WORLD_W - W);
    this.cam = lerp(this.cam, target, Math.min(1, 5 * dt));
    this.shakeMag = Math.max(0, this.shakeMag - dt * 26);
    this.shakeX = R(-this.shakeMag, this.shakeMag);
    this.shakeY = R(-this.shakeMag, this.shakeMag) * 0.7;
  }

  private fire() {
    const p = this.pl;
    const st = this.st;
    p.cd = 1 / st.fireRate;
    p.flash = 0.06;
    const n = st.projectiles;
    const base = p.aim;
    const mzx = p.x + Math.cos(base) * 46;
    const mzy = p.y - 40 + Math.sin(base) * 46;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.08;
      const a = base + off + R(-st.jitter, st.jitter);
      const crit = chance(st.crit);
      this.bullets.push({
        x: mzx, y: mzy,
        vx: Math.cos(a) * st.bulletSpeed, vy: Math.sin(a) * st.bulletSpeed,
        dmg: st.damage * (crit ? 2.2 : 1) * R(0.92, 1.08),
        pierce: st.pierce, crit, life: 1.5, hits: new Set(),
      });
    }
    for (let i = 0; i < 5; i++)
      this.particles.push({ x: mzx, y: mzy, vx: Math.cos(base + R(-0.5, 0.5)) * R(120, 420), vy: Math.sin(base + R(-0.5, 0.5)) * R(120, 420), life: R(0.08, 0.16), max: 0.16, size: R(1.5, 3.5), color: chance(0.5) ? "#fde68a" : "#f59e0b", grav: 0, add: true });
    this.particles.push({ x: p.x - Math.cos(base) * 4, y: p.y - 42, vx: -p.face * R(50, 130), vy: R(-190, -140), life: 0.55, max: 0.55, size: 2, color: "#fbbf24", grav: 1500, add: false });
    p.vx -= Math.cos(base) * 26;
    this.shake(1.1);
    this.sfx.shoot();
  }

  private updateZombies(dt: number) {
    const p = this.pl;
    for (const z of this.zombies) {
      z.t += dt;
      z.atk -= dt;
      z.flash -= dt;
      const dx = p.x - z.x;
      const dir = dx > 0 ? 1 : -1;
      z.face = dir;
      if (z.type === "spitter") {
        const ad = Math.abs(dx);
        if (ad > 400) z.vx = dir * z.speed;
        else if (ad < 230) z.vx = -dir * z.speed * 0.6;
        else z.vx *= 0.85;
        z.spit -= dt;
        if (z.spit <= 0 && ad < 640) {
          z.spit = R(2.1, 3.1);
          this.spitAt(z);
        }
      } else {
        z.vx = lerp(z.vx, dir * z.speed, Math.min(1, 6 * dt));
      }
      z.x = clamp(z.x + z.vx * dt, 10, WORLD_W - 10);
      // contact damage
      if (Math.abs(dx) < z.r + 15 && Math.abs(p.y - z.y) < 56 && z.atk <= 0) {
        z.atk = z.type === "brute" ? 1.15 : 0.8;
        this.hurtPlayer(z.dmg * R(0.9, 1.1), dir * (z.type === "brute" ? 300 : 150));
      }
    }
    // separation
    const zs = this.zombies;
    for (let i = 0; i < zs.length; i++) {
      for (let j = i + 1; j < zs.length; j++) {
        const a = zs[i], b = zs[j];
        const dx = b.x - a.x;
        const min = (a.r + b.r) * 0.72;
        if (Math.abs(dx) < min) {
          const push = (min - Math.abs(dx)) * 0.5 * Math.sign(dx || 1);
          a.x -= push * 0.5;
          b.x += push * 0.5;
        }
      }
    }
    this.zombies = zs.filter((z) => !z.dead);
  }

  private spitAt(z: Zombie) {
    const p = this.pl;
    const dx = p.x - z.x;
    const dy = (p.y - 40) - (z.y - 44 * z.scale);
    const d = Math.hypot(dx, dy) || 1;
    const sp = 330;
    this.eshots.push({ x: z.x, y: z.y - 46 * z.scale, vx: (dx / d) * sp, vy: (dy / d) * sp - 60, dmg: z.dmg, life: 3 });
    this.sfx.spit();
    for (let i = 0; i < 4; i++)
      this.particles.push({ x: z.x, y: z.y - 46 * z.scale, vx: R(-40, 40), vy: R(-40, 10), life: 0.3, max: 0.3, size: R(2, 4), color: "#a3e635", grav: 0, add: true });
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > GROUND + 4) {
        b.life = 0;
        for (let i = 0; i < 3; i++)
          this.particles.push({ x: b.x, y: GROUND, vx: R(-60, 60), vy: R(-120, -40), life: 0.25, max: 0.25, size: 2, color: "#94a3b8", grav: 800, add: false });
        continue;
      }
      for (const z of this.zombies) {
        if (z.dead || b.hits.has(z)) continue;
        const cy = z.y - 36 * z.scale;
        const rr = z.r + 7;
        const dx = b.x - z.x, dy = b.y - cy;
        if (dx * dx + dy * dy < rr * rr * 1.25) {
          b.hits.add(z);
          this.hitZombie(z, b);
          if (b.pierce > 0) b.pierce--;
          else { b.life = 0; break; }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -60 && b.x < WORLD_W + 60);
  }

  private updateEshots(dt: number) {
    const p = this.pl;
    for (const s of this.eshots) {
      s.life -= dt;
      s.vy += 230 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (chance(0.5))
        this.particles.push({ x: s.x, y: s.y, vx: R(-12, 12), vy: R(-12, 12), life: 0.3, max: 0.3, size: 2.4, color: "#84cc16", grav: 0, add: true });
      if (s.y > GROUND + 2) { s.life = 0; continue; }
      const dx = s.x - p.x, dy = s.y - (p.y - 36);
      if (dx * dx + dy * dy < 22 * 22) {
        s.life = 0;
        this.hurtPlayer(s.dmg, Math.sign(s.vx) * 110);
      }
    }
    this.eshots = this.eshots.filter((s) => s.life > 0);
  }

  private updateGems(dt: number) {
    const p = this.pl;
    const mr = 110 * this.st.magnet;
    for (const g of this.gems) {
      g.t += dt;
      const dx = p.x - g.x, dy = (p.y - 34) - g.y;
      const d = Math.hypot(dx, dy);
      if (d < mr) {
        const pull = 620 * (1.15 - d / mr);
        g.vx = (dx / (d || 1)) * pull;
        g.vy = (dy / (d || 1)) * pull;
        g.rest = false;
      } else if (!g.rest) {
        g.vy += 1300 * dt;
        g.vx = lerp(g.vx, 0, Math.min(1, 4 * dt));
        if (g.y >= GROUND - 5) { g.y = GROUND - 5; g.vy *= -0.35; if (Math.abs(g.vy) < 30) { g.rest = true; g.vy = 0; g.vx = 0; } }
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < 24) {
        g.val = -g.val; // mark collected
        this.gainXp(Math.abs(g.val));
        this.particles.push({ x: p.x, y: p.y - 34, vx: R(-30, 30), vy: R(-60, -10), life: 0.3, max: 0.3, size: 3, color: "#a78bfa", grav: 0, add: true });
        this.sfx.gem();
      }
    }
    this.gems = this.gems.filter((g) => g.val > 0);
  }

  private updateParticles(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.y > GROUND + 2 && q.grav > 0) { q.y = GROUND + 2; q.vy *= -0.3; q.vx *= 0.7; }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }

  private updateTexts(dt: number) {
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy = lerp(t.vy, -18, Math.min(1, 3 * dt));
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.texts.length > 40) this.texts.splice(0, this.texts.length - 40);
  }

  /* ---------------- combat resolution ---------------- */

  private hitZombie(z: Zombie, b: Bullet) {
    z.hp -= b.dmg;
    z.flash = 0.09;
    z.vx += Math.sign(b.vx) * (b.crit ? 120 : 60) / z.scale;
    const dir = Math.sign(b.vx);
    for (let i = 0; i < (b.crit ? 8 : 5); i++)
      this.particles.push({ x: b.x, y: b.y, vx: dir * R(30, 190) + R(-60, 60), vy: R(-130, 40), life: R(0.25, 0.5), max: 0.5, size: R(2, 4.5), color: BLOOD[RI(0, BLOOD.length - 1)], grav: 1100, add: false });
    this.texts.push({ x: z.x + R(-8, 8), y: z.y - 74 * z.scale, vy: -60, life: 0.55, max: 0.55, text: String(Math.round(b.dmg)), color: b.crit ? "#fbbf24" : "rgba(255,255,255,.8)", size: b.crit ? 17 : 12 });
    if (this.st.lifesteal > 0) this.pl.hp = Math.min(this.st.maxHp, this.pl.hp + b.dmg * this.st.lifesteal);
    this.sfx.zhit();
    if (z.hp <= 0) this.killZombie(z, dir);
  }

  private killZombie(z: Zombie, dir: number) {
    z.dead = true;
    this.kills++;
    this.score += Math.round(z.score * (1 + this.wave * 0.06));
    this.shake(z.type === "brute" ? 5 : 1.6);
    this.sfx.zdie();
    const cx = z.x, cy = z.y - 34 * z.scale;
    for (let i = 0; i < (z.boss ? 30 : 16); i++)
      this.particles.push({ x: cx + R(-8, 8), y: cy + R(-14, 14), vx: dir * R(20, 160) + R(-110, 110), vy: R(-200, 60), life: R(0.3, 0.7), max: 0.7, size: R(2, 5.5), color: BLOOD[RI(0, BLOOD.length - 1)], grav: 1200, add: false });
    this.decals.push({ x: z.x, s: z.scale, a: 0.55 });
    if (this.decals.length > 70) this.decals.shift();
    // xp gems
    const total = z.xp;
    const n = Math.min(8, Math.max(1, Math.round(total)));
    for (let i = 0; i < n; i++)
      this.gems.push({ x: cx + R(-10, 10), y: cy, vx: R(-90, 90), vy: R(-220, -80), val: total / n, t: R(0, 9), rest: false });
  }

  private hurtPlayer(dmg: number, kx: number) {
    const p = this.pl;
    if (p.ifr > 0 || p.dashT > 0 || this.over) return;
    p.hp -= dmg;
    p.ifr = 0.9;
    p.hurtT = 1;
    p.vx += kx;
    p.vy = Math.min(p.vy, -130);
    this.shake(7);
    this.sfx.hurt();
    for (let i = 0; i < 8; i++)
      this.particles.push({ x: p.x, y: p.y - 36, vx: R(-140, 140), vy: R(-160, 20), life: R(0.25, 0.5), max: 0.5, size: R(2, 4), color: BLOOD[RI(0, BLOOD.length - 1)], grav: 1000, add: false });
    this.texts.push({ x: p.x, y: p.y - 72, vy: -60, life: 0.6, max: 0.6, text: `-${Math.round(dmg)}`, color: "#f87171", size: 15 });
    if (p.hp <= 0) {
      p.hp = 0;
      this.die();
    }
  }

  private die() {
    this.over = true;
    this.shake(13);
    this.sfx.die();
    const p = this.pl;
    for (let i = 0; i < 40; i++)
      this.particles.push({ x: p.x, y: p.y - 34, vx: R(-260, 260), vy: R(-320, 40), life: R(0.4, 1), max: 1, size: R(2, 6), color: chance(0.6) ? BLOOD[RI(0, BLOOD.length - 1)] : "#0e7490", grav: 1100, add: false });
    const isBest = this.score > this.high;
    if (isBest) {
      this.high = this.score;
      localStorage.setItem("graveyard-shift-high", String(this.high));
    }
    const stats: GameStats = {
      wave: this.wave, kills: this.kills, level: this.pl.level,
      score: this.score, time: this.playTime, best: this.high, isBest,
    };
    this.onEvent({ type: "gameover", stats });
  }

  /* ---------------- xp / level / upgrades ---------------- */

  private xpFor(level: number) {
    return Math.round(10 + (level - 1) * 7 + Math.pow(level - 1, 1.6) * 2);
  }

  private gainXp(v: number) {
    const p = this.pl;
    p.xp += v;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = this.xpFor(p.level);
      this.lvlPending++;
    }
    if (this.lvlPending > 0 && !this.modalOpen) this.openLevelModal();
  }

  private openLevelModal() {
    this.modalOpen = true;
    this.sfx.levelup();
    this.onEvent({ type: "levelup", choices: this.rollChoices() });
  }

  private rollChoices(): UpgradeChoice[] {
    const avail = UPGRADES.filter((u) => (this.stacks[u.id] || 0) < u.max);
    const picks: UpgradeDef[] = [];
    const pool = [...avail];
    while (picks.length < Math.min(3, pool.length)) picks.push(pool.splice(RI(0, pool.length - 1), 1)[0]);
    return picks.map((u) => ({
      id: u.id, name: u.name, icon: u.icon, max: u.max, rarity: u.rarity,
      stacks: this.stacks[u.id] || 0,
      desc: u.desc((this.stacks[u.id] || 0) + 1),
    }));
  }

  applyUpgrade(id: string) {
    if (!this.modalOpen) return;
    const prevTier = this.weaponTier();
    this.stacks[id] = (this.stacks[id] || 0) + 1;
    this.recompute();
    if (id === "hp") this.pl.hp = Math.min(this.st.maxHp, this.pl.hp + 30);
    const t = this.weaponTier();
    if (t > prevTier) {
      this.tier = t;
      this.announce("ARSENAL UPGRADED", `${WEAPONS[t - 1]} online`);
    }
    this.sfx.upgrade();
    this.lvlPending--;
    if (this.lvlPending > 0) {
      this.onEvent({ type: "levelup", choices: this.rollChoices() });
    } else {
      this.modalOpen = false;
      this.onEvent({ type: "resume" });
    }
  }

  private weaponTier() {
    const pts = (this.stacks["dmg"] || 0) + (this.stacks["rate"] || 0) + (this.stacks["multi"] || 0) + (this.stacks["pierce"] || 0) + (this.stacks["velo"] || 0);
    return clamp(1 + TIER_PTS.filter((t) => pts >= t).length, 1, WEAPONS.length);
  }

  private recompute() {
    const s = (id: string) => this.stacks[id] || 0;
    this.st = {
      damage: 13 * (1 + 0.3 * s("dmg")),
      fireRate: 3.1 * (1 + 0.22 * s("rate")),
      bulletSpeed: 800 * (1 + 0.3 * s("velo")),
      jitter: Math.max(0.006, 0.02 + 0.01 * s("multi") - 0.007 * s("velo")),
      projectiles: 1 + s("multi"),
      pierce: s("pierce"),
      crit: 0.05 + 0.12 * s("crit"),
      speed: 275 * (1 + 0.16 * s("speed")),
      maxHp: 100 + 30 * s("hp"),
      magnet: 1 + 0.7 * s("magnet"),
      lifesteal: 0.03 * s("vamp"),
      regen: 0.9 * s("regen"),
      dashMax: 2.3 * Math.pow(0.68, s("dash")),
    };
  }

  /* ---------------- waves ---------------- */

  private buildWave(n: number): SpawnItem[] {
    const items: SpawnItem[] = [];
    const count = Math.min(52, Math.round(5 + n * 2.6 + n * n * 0.12));
    const wWalker = 1;
    const wRunner = n >= 2 ? 0.42 + n * 0.02 : 0;
    const wSpitter = n >= 4 ? 0.3 : 0;
    const wBrute = n >= 3 ? 0.14 + n * 0.015 : 0;
    const total = wWalker + wRunner + wSpitter + wBrute;
    for (let i = 0; i < count; i++) {
      let roll = Math.random() * total;
      let type: ZType = "walker";
      if ((roll -= wWalker) < 0) type = "walker";
      else if ((roll -= wRunner) < 0) type = "runner";
      else if ((roll -= wSpitter) < 0) type = "spitter";
      else type = "brute";
      items.push({ type });
    }
    if (n % 5 === 0) items.push({ type: "brute", boss: true });
    // shuffle
    for (let i = items.length - 1; i > 0; i--) {
      const j = RI(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  private startWave(n: number) {
    this.wave = n;
    this.queue = this.buildWave(n);
    this.waveTotal = this.queue.length;
    this.phase = "active";
    this.spawnT = 0.6;
    this.announce(`WAVE ${n}`, WAVE_SUBS[n % WAVE_SUBS.length]);
    this.sfx.wave();
  }

  private mkZombie(type: ZType, x: number, hpMul: number, speedMul: number): Zombie {
    const c = ZCONF[type];
    const scale = c.scale * R(0.94, 1.07);
    const hp = c.hp * hpMul;
    return {
      x, y: GROUND, vx: 0,
      hp, maxHp: hp,
      speed: c.speed * speedMul * R(0.9, 1.1),
      dmg: c.dmg, r: c.r * scale, scale,
      type, xp: c.xp, score: c.score,
      t: R(0, 10), atk: R(0, 0.4), flash: 0, face: 1, dead: false, spit: R(1, 2.4),
      tint: Math.random(), boss: false, wob: R(0, TAU),
    };
  }

  private spawnZombie(it: SpawnItem) {
    const n = this.wave;
    const hpMul = (1 + (n - 1) * 0.22) * (it.boss ? 4.4 : 1);
    const speedMul = 1 + Math.min(0.55, (n - 1) * 0.035);
    const dmgMul = 1 + (n - 1) * 0.07;
    let x: number;
    const side = chance(0.5) ? -1 : 1;
    x = side < 0 ? this.cam - 90 - R(0, 320) : this.cam + W + 90 + R(0, 320);
    x = clamp(x, 22, WORLD_W - 22);
    if (Math.abs(x - this.pl.x) < 240) x = clamp(this.pl.x - side * 620, 22, WORLD_W - 22);
    const z = this.mkZombie(it.type, x, hpMul, speedMul);
    z.dmg *= dmgMul;
    if (it.boss) {
      z.scale *= 1.32;
      z.r = 30 * z.scale;
      z.boss = true;
      z.xp = 16;
      z.score = 200;
      this.announce("SOMETHING BIG STIRS", "bring it down");
      this.shake(4);
    }
    z.face = x > this.pl.x ? -1 : 1;
    this.zombies.push(z);
    for (let i = 0; i < 8; i++)
      this.particles.push({ x, y: GROUND, vx: R(-70, 70), vy: R(-180, -20), life: R(0.3, 0.6), max: 0.6, size: R(2, 5), color: "#241d18", grav: 900, add: false });
  }

  /* ---------------- fx helpers ---------------- */

  private shake(m: number) {
    this.shakeMag = Math.min(16, this.shakeMag + m);
  }

  private announce(text: string, sub: string, dur = 2.2) {
    this.banners.push({ text, sub, t: dur, dur });
  }

  private updateBanner(dt: number) {
    if (this.banners.length > 0) {
      this.banners[0].t -= dt;
      if (this.banners[0].t <= 0) this.banners.shift();
    }
  }

  /* ---------------- hud ---------------- */

  getHud(): HudState {
    const p = this.pl;
    return {
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: this.st.maxHp,
      xp: Math.round(p.xp),
      xpNext: p.xpNext,
      level: p.level,
      wave: this.wave,
      waveTotal: this.waveTotal,
      remaining: this.queue.length + this.zombies.length,
      score: this.score,
      kills: this.kills,
      high: this.high,
      dashT: Math.max(0, p.dashCd),
      dashMax: this.st.dashMax,
      weapon: WEAPONS[this.tier - 1],
      tier: this.tier,
      tierMax: WEAPONS.length,
      paused: this.paused,
      muted: this.sfx.muted,
      playing: this.mode === "play" && !this.over,
    };
  }

  /* ================================================================== */
  /* RENDER                                                             */
  /* ================================================================== */

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private render() {
    const c = this.ctx;
    const t = this.tGlobal;
    const cam = this.cam + this.shakeX;
    const camY = this.shakeY;

    c.clearRect(0, 0, W, H);

    /* --- sky --- */
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#03050c");
    sky.addColorStop(0.5, "#0a1122");
    sky.addColorStop(0.78, "#231a33");
    sky.addColorStop(1, "#0a0d16");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    /* --- stars --- */
    c.save();
    for (const s of this.stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
      c.globalAlpha = a;
      c.fillStyle = "#dbeafe";
      c.fillRect(s.x - this.cam * 0.04, s.y, s.r, s.r);
    }
    c.restore();

    /* --- moon --- */
    const mx = 1010 - this.cam * 0.055;
    const my = 128 + camY * 0.2;
    const glow = c.createRadialGradient(mx, my, 10, mx, my, 190);
    glow.addColorStop(0, "rgba(245,238,205,0.28)");
    glow.addColorStop(0.35, "rgba(200,190,210,0.10)");
    glow.addColorStop(1, "rgba(200,190,210,0)");
    c.fillStyle = glow;
    c.fillRect(mx - 200, my - 200, 400, 400);
    c.fillStyle = "#efe9d2";
    c.beginPath();
    c.arc(mx, my, 52, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(120,110,90,0.18)";
    c.beginPath(); c.arc(mx - 14, my - 10, 11, 0, TAU); c.fill();
    c.beginPath(); c.arc(mx + 16, my + 14, 8, 0, TAU); c.fill();
    c.beginPath(); c.arc(mx + 4, my - 22, 6, 0, TAU); c.fill();

    /* --- skylines --- */
    this.drawSkyline(this.skyFar, 0.18, "#0d1526", cam, false);
    this.drawSkyline(this.skyNear, 0.38, "#080d1a", cam, true);

    /* --- drifting fog band --- */
    for (let i = 0; i < 3; i++) {
      const fx = ((t * (6 + i * 3) + i * 480) % (W + 500)) - 250;
      const fogGrad = c.createRadialGradient(fx, 480 + i * 26, 0, fx, 480 + i * 26, 240);
      fogGrad.addColorStop(0, "rgba(148,163,184,0.05)");
      fogGrad.addColorStop(1, "rgba(148,163,184,0)");
      c.fillStyle = fogGrad;
      c.fillRect(fx - 240, 380, 480, 200);
    }

    /* --- mid decor (graveyard) --- */
    c.save();
    c.translate(-this.cam * 0.68, camY * 0.5);
    for (const d of this.decor) this.drawDecor(d, t);
    c.restore();

    /* --- ground --- */
    c.save();
    c.translate(-cam, camY);
    const gg = c.createLinearGradient(0, GROUND, 0, H);
    gg.addColorStop(0, "#131a14");
    gg.addColorStop(0.12, "#0d120e");
    gg.addColorStop(1, "#04060a");
    c.fillStyle = gg;
    c.fillRect(cam - 60, GROUND, W + 120, H - GROUND);
    c.strokeStyle = "rgba(74,124,82,0.5)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cam - 60, GROUND + 0.5);
    c.lineTo(cam + W + 60, GROUND + 0.5);
    c.stroke();
    // tufts
    c.strokeStyle = "rgba(52,84,56,0.7)";
    c.lineWidth = 1.4;
    for (const tu of this.tufts) {
      if (tu.x < cam - 40 || tu.x > cam + W + 40) continue;
      const sway = Math.sin(t * 1.4 + tu.x) * 1.4;
      c.beginPath();
      c.moveTo(tu.x, GROUND + 1);
      c.quadraticCurveTo(tu.x + sway, GROUND - tu.h * 0.6, tu.x - 3 * tu.s + sway, GROUND - tu.h);
      c.moveTo(tu.x + 4, GROUND + 1);
      c.quadraticCurveTo(tu.x + 4 + sway, GROUND - tu.h * 0.5, tu.x + 7 * tu.s + sway, GROUND - tu.h * 0.8);
      c.stroke();
    }
    // blood decals
    for (const d of this.decals) {
      c.fillStyle = `rgba(80,14,18,${d.a})`;
      c.beginPath();
      c.ellipse(d.x, GROUND + 7, 20 * d.s, 4.5 * d.s, 0, 0, TAU);
      c.fill();
      c.fillStyle = `rgba(60,10,12,${d.a * 0.8})`;
      c.beginPath();
      c.ellipse(d.x + 14 * d.s, GROUND + 10, 8 * d.s, 2.5 * d.s, 0, 0, TAU);
      c.fill();
    }
    c.restore();

    /* --- gems / zombies / player / projectiles --- */
    c.save();
    c.translate(-cam, camY);
    for (const g of this.gems) this.drawGem(g, t);
    c.restore();

    for (const z of this.zombies) this.drawZombie(z, cam, camY, t);
    if (this.mode === "play" && !this.over) this.drawPlayer(cam, camY, t);

    c.save();
    c.translate(-cam, camY);
    // bullets (additive tracers)
    c.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      c.strokeStyle = b.crit ? "rgba(251,191,36,0.95)" : "rgba(253,230,138,0.85)";
      c.lineWidth = b.crit ? 3.4 : 2.4;
      c.beginPath();
      c.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      c.lineTo(b.x, b.y);
      c.stroke();
      c.fillStyle = "#fff7d6";
      c.beginPath();
      c.arc(b.x, b.y, b.crit ? 2.6 : 1.8, 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = "source-over";
    // enemy shots
    for (const s of this.eshots) {
      const gr = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 12);
      gr.addColorStop(0, "rgba(190,242,100,0.95)");
      gr.addColorStop(0.4, "rgba(132,204,22,0.5)");
      gr.addColorStop(1, "rgba(132,204,22,0)");
      c.fillStyle = gr;
      c.fillRect(s.x - 12, s.y - 12, 24, 24);
      c.fillStyle = "#d9f99d";
      c.beginPath();
      c.arc(s.x, s.y, 3.4, 0, TAU);
      c.fill();
    }
    c.restore();

    /* --- particles --- */
    c.save();
    c.translate(-cam, camY);
    let additive = false;
    for (const q of this.particles) {
      if (q.add !== additive) {
        c.globalCompositeOperation = q.add ? "lighter" : "source-over";
        additive = q.add;
      }
      const a = clamp(q.life / q.max, 0, 1);
      c.globalAlpha = a * (q.add ? 0.8 : 1);
      c.fillStyle = q.color;
      c.beginPath();
      c.arc(q.x, q.y, q.size * (0.5 + 0.5 * a), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.restore();

    /* --- float texts --- */
    c.save();
    c.translate(-cam, camY);
    c.textAlign = "center";
    for (const ft of this.texts) {
      const a = clamp(ft.life / ft.max, 0, 1);
      c.globalAlpha = a;
      c.font = `700 ${ft.size}px "Space Grotesk", sans-serif`;
      c.fillStyle = ft.color;
      c.fillText(ft.text, ft.x, ft.y);
    }
    c.restore();

    /* --- foreground fog wisps --- */
    for (let i = 0; i < 2; i++) {
      const fx = W - ((t * (10 + i * 5) + i * 640) % (W + 560)) + 280 - 280;
      const fg = c.createRadialGradient(fx, GROUND + 40, 0, fx, GROUND + 40, 200);
      fg.addColorStop(0, "rgba(148,163,184,0.045)");
      fg.addColorStop(1, "rgba(148,163,184,0)");
      c.fillStyle = fg;
      c.fillRect(fx - 200, GROUND - 80, 400, 240);
    }

    /* --- hurt / low-hp vignette --- */
    if (this.mode === "play" && !this.over) {
      const pct = this.pl.hp / this.st.maxHp;
      const lowHp = pct < 0.32 ? (0.32 - pct) * (1.4 + 0.5 * Math.sin(t * 5.5)) : 0;
      const a = clamp(this.pl.hurtT * 0.3 + lowHp, 0, 0.5);
      if (a > 0.01) {
        const hg = c.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
        hg.addColorStop(0, "rgba(153,27,27,0)");
        hg.addColorStop(1, `rgba(127,20,20,${a})`);
        c.fillStyle = hg;
        c.fillRect(0, 0, W, H);
      }
      // dash ghost cooldown glow at player feet
      if (this.pl.dashCd <= 0 && this.paused === false && this.modalOpen === false) {
        c.save();
        c.translate(this.pl.x - cam, GROUND + 6);
        c.globalAlpha = 0.12 + 0.08 * Math.sin(t * 4);
        c.fillStyle = "#67e8f9";
        c.beginPath();
        c.ellipse(0, 0, 22, 4.5, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    }

    /* --- banner --- */
    if (this.banners.length > 0) this.drawBanner(this.banners[0]);

    /* --- next wave countdown --- */
    if (this.mode === "play" && !this.over && this.phase === "break" && this.wave > 0) {
      c.textAlign = "center";
      c.font = '600 13px "Space Grotesk", sans-serif';
      c.fillStyle = "rgba(226,232,240,0.55)";
      (c as unknown as { letterSpacing: string }).letterSpacing = "4px";
      c.fillText(`NEXT WAVE IN ${Math.max(1, Math.ceil(this.breakT))}`, W / 2, H - 48);
      (c as unknown as { letterSpacing: string }).letterSpacing = "0px";
    }

    /* --- reticle --- */
    if (this.mode === "play" && !this.over && !this.modalOpen && !this.paused) {
      const r = 11 + Math.max(0, this.pl.cd) * 14;
      c.strokeStyle = "rgba(254,240,138,0.9)";
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(this.mouse.x, this.mouse.y, r, 0, TAU);
      c.stroke();
      c.beginPath();
      for (const [ox, oy] of [[r + 3, 0], [-r - 3, 0], [0, r + 3], [0, -r - 3]]) {
        c.moveTo(this.mouse.x + ox * 1.6, this.mouse.y + oy * 1.6);
        c.lineTo(this.mouse.x + ox * 0.8, this.mouse.y + oy * 0.8);
      }
      c.stroke();
      c.fillStyle = "rgba(254,240,138,0.9)";
      c.beginPath();
      c.arc(this.mouse.x, this.mouse.y, 1.6, 0, TAU);
      c.fill();
    }
  }

  private drawBanner(b: Banner) {
    const c = this.ctx;
    const p = 1 - b.t / b.dur;
    const a = p < 0.12 ? p / 0.12 : p > 0.72 ? (1 - p) / 0.28 : 1;
    const s = 1 + (1 - Math.min(1, p * 7)) * 0.35;
    c.save();
    c.translate(W / 2, 208);
    c.scale(s, s);
    c.globalAlpha = clamp(a, 0, 1);
    c.textAlign = "center";
    (c as unknown as { letterSpacing: string }).letterSpacing = "10px";
    c.font = "400 58px Anton, sans-serif";
    c.shadowColor = "rgba(245,158,11,0.5)";
    c.shadowBlur = 30;
    c.fillStyle = "#f4efe6";
    c.fillText(b.text, 0, 0);
    c.shadowBlur = 0;
    c.font = '600 15px "Space Grotesk", sans-serif';
    (c as unknown as { letterSpacing: string }).letterSpacing = "5px";
    c.fillStyle = "#f59e0b";
    c.fillText(b.sub.toUpperCase(), 0, 36);
    (c as unknown as { letterSpacing: string }).letterSpacing = "0px";
    c.restore();
  }

  private drawSkyline(bld: Building[], p: number, color: string, cam: number, windows: boolean) {
    const c = this.ctx;
    c.save();
    c.translate(-cam * p, 0);
    c.fillStyle = color;
    for (const b of bld) {
      const top = GROUND - b.h * 0.9 - 60;
      c.fillRect(b.x, top, b.w, GROUND - top + 60);
      if (b.w > 60) {
        c.fillRect(b.x + b.w * 0.5 - 1.5, top - 14, 3, 14); // antenna
      }
      if (windows && b.win > 0.35) {
        c.fillStyle = "rgba(245,158,11,0.07)";
        const cols = Math.floor(b.w / 14);
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < 4; j++) {
            if ((i * 7 + j * 3 + Math.floor(b.x)) % 5 < 2)
              c.fillRect(b.x + 5 + i * 14, top + 10 + j * 18, 4, 6);
          }
        }
        c.fillStyle = color;
      }
    }
    c.restore();
  }

  private drawDecor(d: Decor, t: number) {
    const c = this.ctx;
    const base = GROUND + 4;
    c.save();
    c.translate(d.x, base);
    c.scale(d.s, d.s);
    if (d.kind === 0 || d.kind === 1) {
      // tombstones
      c.fillStyle = "#141b29";
      c.strokeStyle = "rgba(148,163,184,0.12)";
      c.lineWidth = 1;
      if (d.kind === 0) {
        this.rr(-11, -34, 22, 34, 8);
        c.fill();
        c.stroke();
        c.strokeStyle = "rgba(148,163,184,0.2)";
        c.beginPath();
        c.moveTo(0, -28); c.lineTo(0, -18);
        c.moveTo(-5, -24); c.lineTo(5, -24);
        c.stroke();
      } else {
        this.rr(-13, -26, 26, 26, 4);
        c.fill();
        c.stroke();
      }
    } else if (d.kind === 2) {
      // dead tree
      c.strokeStyle = "#060a12";
      c.lineWidth = 6;
      c.lineCap = "round";
      const sway = Math.sin(t * 0.7 + d.ph) * 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(4 + sway, -48, sway, -92);
      c.stroke();
      c.lineWidth = 3.4;
      c.beginPath();
      c.moveTo(sway, -58);
      c.quadraticCurveTo(-16 + sway, -72, -30, -88);
      c.moveTo(2 + sway, -70);
      c.quadraticCurveTo(18 + sway, -84, 26, -104);
      c.moveTo(sway, -84);
      c.quadraticCurveTo(-8 + sway, -98, -12, -116);
      c.stroke();
    } else {
      // crooked lamp post
      c.strokeStyle = "#0b0f18";
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(-8, -96);
      c.lineTo(10, -102);
      c.stroke();
      const flick = 0.75 + 0.25 * Math.sin(t * 9 + d.ph) * Math.sin(t * 3.7 + d.ph);
      c.fillStyle = `rgba(253,186,116,${0.75 * flick})`;
      c.beginPath();
      c.arc(12, -100, 4, 0, TAU);
      c.fill();
      const lg = c.createRadialGradient(12, -100, 2, 12, -100, 52);
      lg.addColorStop(0, `rgba(251,146,60,${0.16 * flick})`);
      lg.addColorStop(1, "rgba(251,146,60,0)");
      c.fillStyle = lg;
      c.fillRect(-44, -156, 116, 116);
    }
    c.restore();
  }

  private drawGem(g: Gem, t: number) {
    const c = this.ctx;
    const bob = Math.sin(t * 3 + g.t) * 2.5;
    const y = g.rest || g.vy === 0 ? g.y + bob : g.y;
    const s = 3.5 + Math.min(3, g.val);
    c.globalCompositeOperation = "lighter";
    const gr = c.createRadialGradient(g.x, y, 0, g.x, y, s * 4);
    gr.addColorStop(0, "rgba(167,139,250,0.5)");
    gr.addColorStop(1, "rgba(167,139,250,0)");
    c.fillStyle = gr;
    c.fillRect(g.x - s * 4, y - s * 4, s * 8, s * 8);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#c4b5fd";
    c.beginPath();
    c.moveTo(g.x, y - s);
    c.lineTo(g.x + s * 0.8, y);
    c.lineTo(g.x, y + s);
    c.lineTo(g.x - s * 0.8, y);
    c.closePath();
    c.fill();
    c.fillStyle = "#ede9fe";
    c.beginPath();
    c.moveTo(g.x, y - s * 0.5);
    c.lineTo(g.x + s * 0.35, y);
    c.lineTo(g.x, y + s * 0.5);
    c.lineTo(g.x - s * 0.35, y);
    c.closePath();
    c.fill();
  }

  private drawZombie(z: Zombie, cam: number, camY: number, t: number) {
    const c = this.ctx;
    const px = z.x - cam;
    if (px < -100 || px > W + 100) return;
    const py = z.y + camY;
    // shadow
    c.fillStyle = "rgba(0,0,0,0.42)";
    c.beginPath();
    c.ellipse(px, GROUND + 5 + camY, 17 * z.scale, 4.5, 0, 0, TAU);
    c.fill();

    const skin = SKIN[Math.floor(z.tint * SKIN.length) % SKIN.length];
    const cloth = CLOTH[Math.floor(z.tint * 7) % CLOTH.length];
    const walk = z.t * (2.6 + z.speed * 0.028);
    const shamble = Math.sin(walk);
    const attacking = z.atk > (z.type === "brute" ? 0.75 : 0.42);

    c.save();
    c.translate(px, py);
    c.scale(z.face * z.scale, z.scale);

    // legs
    c.strokeStyle = "#1d2430";
    c.lineWidth = 6.4;
    c.lineCap = "round";
    const l1 = shamble * 7, l2 = -shamble * 7;
    c.beginPath();
    c.moveTo(-2, -28); c.lineTo(-3 + l1 * 0.5, -14); c.lineTo(-4 + l1, 0);
    c.moveTo(2, -28); c.lineTo(3 + l2 * 0.5, -13); c.lineTo(4 + l2, 0);
    c.stroke();

    // torso
    c.save();
    c.translate(0, -28);
    c.rotate(0.14 + Math.sin(walk * 0.5 + z.wob) * 0.05);
    c.fillStyle = cloth;
    this.rr(-9, -26, 19, 28, 5);
    c.fill();
    // rips
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.fillRect(-6, -12, 4, 7);
    c.fillRect(3, -20, 3, 5);

    // arms — reaching forward
    c.strokeStyle = skin;
    c.lineCap = "round";
    const reach = attacking ? 6 : 0;
    c.lineWidth = 5.4;
    c.beginPath();
    c.moveTo(1, -20);
    c.lineTo(13 + reach, -18 + Math.sin(walk) * 2);
    c.lineTo(20 + reach, -12 + Math.sin(walk) * 2.5);
    c.stroke();
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(0, -16);
    c.lineTo(11 + reach, -10 + Math.cos(walk * 0.8) * 2);
    c.stroke();
    c.globalAlpha = 1;

    // head
    c.fillStyle = skin;
    c.beginPath();
    c.arc(6, -34, 8.6, 0, TAU);
    c.fill();
    // jaw
    c.fillStyle = "rgba(0,0,0,0.3)";
    c.fillRect(8, -29, 6, 3);
    // eyes
    const eye = z.boss || z.type === "brute" ? "#f87171" : "#fef08a";
    c.fillStyle = eye;
    c.beginPath(); c.arc(10.5, -36, 1.7, 0, TAU); c.fill();
    c.beginPath(); c.arc(10.5, -31.5, 1.4, 0, TAU); c.fill();
    c.globalAlpha = 0.3;
    c.beginPath(); c.arc(10.5, -36, 3.4, 0, TAU); c.fill();
    c.globalAlpha = 1;

    // spitter sack
    if (z.type === "spitter") {
      c.fillStyle = "rgba(132,204,22,0.85)";
      c.beginPath();
      c.arc(2, -8, 6 + Math.sin(t * 5 + z.wob) * 1.2, 0, TAU);
      c.fill();
    }

    // hit flash
    if (z.flash > 0) {
      c.globalAlpha = clamp(z.flash * 9, 0, 0.85);
      c.fillStyle = "#ffffff";
      this.rr(-9, -26, 19, 28, 5);
      c.fill();
      c.beginPath();
      c.arc(6, -34, 8.6, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore(); // torso
    c.restore(); // root

    // hp bar
    if (z.hp < z.maxHp) {
      const wBar = 30 * z.scale;
      const xBar = px - wBar / 2;
      const yBar = py - 74 * z.scale;
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(xBar, yBar, wBar, 3.4);
      c.fillStyle = z.boss ? "#f87171" : "#dc2626";
      c.fillRect(xBar, yBar, wBar * clamp(z.hp / z.maxHp, 0, 1), 3.4);
    }
  }

  private drawPlayer(cam: number, camY: number, t: number) {
    const c = this.ctx;
    const p = this.pl;
    const px = p.x - cam;
    const py = p.y + camY;

    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath();
    c.ellipse(px, GROUND + 5 + camY, 19, 4.5, 0, 0, TAU);
    c.fill();

    c.save();
    c.translate(px, py);
    if (p.ifr > 0) c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 42);
    if (p.dashT > 0) c.globalAlpha = 0.8;

    const run = Math.abs(p.vx) > 26 && p.grounded;
    const bob = run ? Math.abs(Math.sin(p.walk)) * 2.2 : p.grounded ? Math.sin(t * 2.1) * 0.9 : -2;
    const swing = run ? Math.sin(p.walk) * 0.55 : 0;
    const airLegs = !p.grounded;

    c.save();
    c.scale(p.face, 1);

    // legs
    c.strokeStyle = "#1f2a3a";
    c.lineWidth = 7;
    c.lineCap = "round";
    const l1 = airLegs ? 6 : swing * 8;
    const l2 = airLegs ? -7 : -swing * 8;
    c.beginPath();
    c.moveTo(-1, -28 + bob);
    c.lineTo(-2 + l1 * 0.55, -14 + bob * 0.5);
    c.lineTo(-3 + l1, airLegs ? -8 : 0);
    c.moveTo(1, -28 + bob);
    c.lineTo(2 + l2 * 0.55, -13 + bob * 0.5);
    c.lineTo(3 + l2, airLegs ? -4 : 0);
    c.stroke();
    // boots
    c.fillStyle = "#0b0f16";
    c.fillRect(-6 + (airLegs ? 6 : swing * 8), airLegs ? -10 : -2.5, 10, 4.5);
    c.fillRect(-2 + (airLegs ? -7 : -swing * 8), airLegs ? -6 : -2.5, 10, 4.5);

    // torso (jacket)
    c.fillStyle = "#0e7490";
    this.rr(-10, -56 + bob, 20, 28, 6);
    c.fill();
    c.fillStyle = "#155e75";
    this.rr(-10, -56 + bob, 20, 9, 6);
    c.fill();
    // zipper
    c.strokeStyle = "rgba(255,255,255,0.25)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -47 + bob);
    c.lineTo(0, -30 + bob);
    c.stroke();

    // head + beanie
    c.fillStyle = "#e8b08c";
    c.beginPath();
    c.arc(2, -63 + bob, 8.4, 0, TAU);
    c.fill();
    c.fillStyle = "#7f1d1d";
    c.beginPath();
    c.arc(2, -65.4 + bob, 8.6, Math.PI * 1.02, Math.PI * 1.98);
    c.fill();
    c.fillRect(-6.6, -67.4 + bob, 17.2, 3.4);
    // eye
    c.fillStyle = "#1c1917";
    c.fillRect(6.4, -63.5 + bob, 2.2, 2.4);

    // arm + gun (rotates with aim)
    const aimL = p.face === 1 ? p.aim : Math.PI - p.aim;
    c.save();
    c.translate(1, -49 + bob);
    c.rotate(clamp(aimL, -1.25, 1.25));
    c.strokeStyle = "#0b5a6e";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(14, 0);
    c.stroke();
    // gun
    c.fillStyle = "#0f172a";
    this.rr(10, -5.5, 30, 9, 2);
    c.fill();
    c.fillStyle = "#334155";
    c.fillRect(34, -3.5, 13, 4);
    c.fillRect(17, 2.5, 5, 9);
    c.fillStyle = "#64748b";
    c.fillRect(12, -5.5, 8, 2);
    // muzzle flash
    if (p.flash > 0) {
      const fa = clamp(p.flash * 16, 0, 1);
      c.globalCompositeOperation = "lighter";
      const fg = c.createRadialGradient(50, 0, 0, 50, 0, 26);
      fg.addColorStop(0, `rgba(254,240,138,${0.95 * fa})`);
      fg.addColorStop(0.4, `rgba(251,146,60,${0.6 * fa})`);
      fg.addColorStop(1, "rgba(251,146,60,0)");
      c.fillStyle = fg;
      c.fillRect(50 - 26, -26, 52, 52);
      c.strokeStyle = `rgba(254,240,138,${0.8 * fa})`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(50, 0); c.lineTo(50 + 16 * fa, -7 * fa);
      c.moveTo(50, 0); c.lineTo(50 + 18 * fa, 5 * fa);
      c.stroke();
      c.globalCompositeOperation = "source-over";
    }
    c.restore(); // arm/gun
    c.restore(); // face scale
    c.restore(); // root

    // muzzle world light
    if (p.flash > 0) {
      const mzx = p.x + Math.cos(p.aim) * 50 - cam;
      const mzy = p.y - 49 + bob + Math.sin(p.aim) * 50 + camY;
      this.ctx.globalCompositeOperation = "lighter";
      const lg = this.ctx.createRadialGradient(mzx, mzy, 4, mzx, mzy, 130);
      lg.addColorStop(0, `rgba(251,191,36,${0.16 * clamp(p.flash * 16, 0, 1)})`);
      lg.addColorStop(1, "rgba(251,191,36,0)");
      this.ctx.fillStyle = lg;
      this.ctx.fillRect(mzx - 130, mzy - 130, 260, 260);
      this.ctx.globalCompositeOperation = "source-over";
    }
  }
}
