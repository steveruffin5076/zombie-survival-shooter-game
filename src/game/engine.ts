import { UPGRADES, type UpgradeDef } from "./upgrades";
import {
  WEAPONS as WDEF, WEAPON_IDS, CLASS_ORDER, CLASS_LABEL, CLASS_ROLE, byClass, STARTER,
  type WeaponClass, type WeaponDef,
} from "./weapons";
import { Sfx } from "./audio";
import { loadSettings, saveSettings } from "./settings";
import { ATTACHMENT_ORDER, applyAttachment, unlockedAttachments, weaponLevelFor, type AttachmentId } from "./attachments";
import { stageDefFor, cumulativeWaveIndex, difficultyFor, rollEnemy, type StageDef } from "./stages";
import { WEAPON_UNLOCK_LEVEL, metaXpFor, ownedWeaponsForLevel, isWeaponUnlocked } from "./progression";
import { THEMES, type ThemeDef } from "./themes";
import { BACKPACK_SIZE, moveItem, placeItem, removeItem, type PlacedItem } from "./grid";
import { ITEMS, shapeOfItem, itemForHotkey, type ConsumableKey } from "./items";
import { rollLoot, type CrateTier } from "./loot";
import {
  saveRun, loadRun, SAVE_VERSION, type SaveData,
  loadProfile, saveProfile, type ProfileData,
} from "./save";
import {
  DEPLOYABLE_DEFS, canPlaceAt, slotToWorldX, worldXToSlot,
  type Deployable, type DeployableKind,
} from "./arena";
import {
  BOSS_DEFS, cooldownFor, phaseFor, pickAttack, windupFor,
  type AimTarget, type BossAttack,
} from "./boss";
import type { EngineEvent, GameStats, HudState, InventorySnapshot, ProfileSnapshot, UpgradeChoice } from "./types";

/* ------------------------------------------------------------------ */
/* constants + helpers                                                 */
/* ------------------------------------------------------------------ */

const W = 1280;
const H = 720;
const GROUND = 584; // Kept for compatibility with attract mode and particle effects
// Top-down camera: world bounds for player movement
const WORLD_H = 1440; // vertical play area height
const TAU = Math.PI * 2;

const R = (a: number, b: number) => a + Math.random() * (b - a);
const RI = (a: number, b: number) => Math.floor(R(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const chance = (p: number) => Math.random() < p;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Darkens (factor<1) or lightens (factor>1) a "#rrggbb" hex color — used to
 * derive a boss's torso/limb/head tones from one BossDef.color. */
const shadeHex = (hex: string, factor: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => clamp(Math.round(((n >> shift) & 0xff) * factor), 0, 255);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

type ZType = "walker" | "runner" | "brute" | "spitter" | "screamer";
type ModalKind = "levelup" | "stageclear";

interface ZConf {
  hp: number; speed: number; dmg: number; r: number; scale: number; xp: number; score: number;
}

const ZCONF: Record<ZType, ZConf> = {
  walker: { hp: 34, speed: 52, dmg: 9, r: 19, scale: 1, xp: 1, score: 10 },
  runner: { hp: 20, speed: 128, dmg: 7, r: 15, scale: 0.88, xp: 2, score: 14 },
  spitter: { hp: 30, speed: 46, dmg: 8, r: 16, scale: 0.95, xp: 2, score: 22 },
  brute: { hp: 150, speed: 36, dmg: 22, r: 30, scale: 1.5, xp: 6, score: 45 },
  // the Screamer — fragile and slow, but punishes a sloppy kill hard
  // (an ambush), so worth notably more than her stats alone suggest
  screamer: { hp: 18, speed: 40, dmg: 6, r: 15, scale: 0.85, xp: 4, score: 35 },
};

/** A rare, deliberate encounter across every stage — not power-scaled like the
 * base roster, so she stays a fixed low-probability spice pick, never fodder. */
const SCREAMER_WEIGHT = 0.18;

/** Stages whose final wave is a horde finale instead of a normal wave — a
 * sustained swarm with a boss-tier zombie mixed in, capping the stage with a
 * real set piece rather than just another wave-sized batch. */
const HORDE_STAGES = [5, 10];
const HORDE_DURATION = 60;

/** Half-angle of the flashlight's fully-lit cone (see render()'s darkenOutside
 * calls) — also the field auto-fire scans for a target, so "in the flashlight"
 * means the same thing visually and mechanically. */
const FLASHLIGHT_HALF_ANGLE = 0.55;

/** How long the Terminal Defense boss spends rising out of its grave —
 * invulnerable and inert — before the fight actually starts. */
const BOSS_EMERGE_DURATION = 1.6;

/** Seconds an uncollected XP/scrap gem sits before despawning — long enough
 * that mid-fight drops aren't lost, short enough that gems don't pile up
 * forever if you never backtrack for them. Fades out over the last 2s. */
const GEM_LIFETIME = 12;

const WAVE_SUBS = [
  "they see your light",
  "hold the line",
  "the horde thickens",
  "no mercy",
  "they just keep coming",
  "stay quiet, stay dark",
];

const SKIN = ["#7a8f66", "#6d8560", "#87976b", "#5f7a55"];
const CLOTH = ["#2a3040", "#33272b", "#24303a", "#3a3230"];
const BLOOD = ["#7f1d1d", "#991b1b", "#b91c1c", "#5f1118"];

interface Zombie {
  x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; speed: number; dmg: number; r: number; scale: number;
  type: ZType; xp: number; score: number;
  t: number; atk: number; flash: number; face: number; dead: boolean; spit: number;
  tint: number; boss: boolean; wob: number;
  /** sleeper: inert until a hit (an instant quiet kill), a fast player passing close, or a hazard */
  dormant: boolean;
  /** screamer only: 0 idle, >0 counting down to her scream, -1 already spent */
  alertT: number;
  /** arena only — id of the barricade currently blocking this zombie's advance */
  blockedBy: string | null;
  /** arena only — razor wire slow remaining, seconds */
  slowT: number;
  /** Incendiary Rounds — seconds left burning, and current damage-per-second */
  burnT: number;
  burnDps: number;
}

/** The Juggernaut Alpha — a unique boss encounter, deliberately kept out of `zombies[]` so its
 * windup/attack state machine doesn't have to fit the generic per-zombie walk-toward-player loop. */
interface Boss extends AimTarget {
  /** which BOSS_DEFS entry this instance is — looked up wherever attack/timing/art needs it */
  defId: string;
  vx: number; face: 1 | -1; flash: number; hurtT: number;
  hp: number; maxHp: number; phase: 0 | 1 | 2;
  /** "emerge" — rising out of its grave, invulnerable and inert, on spawn */
  state: "emerge" | "seek" | "windup" | "attack" | "cooldown";
  attack: BossAttack | null;
  /** counts down within the current state */
  timer: number;
  /** melee contact-damage cooldown, same idiom as Zombie.atk */
  atk: number;
  /** locked-in strike point for Puke Mortar, set the instant its windup starts */
  targetX: number; targetY: number;
  tint: number; wob: number; t: number;
}

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  dmg: number; pierce: number; crit: boolean; life: number;
  hits: Set<Zombie>;
  /** guards against re-hitting the boss on a later frame while a piercing shot is still overlapping it */
  hitBoss: boolean;
}

interface EShot { x: number; y: number; vx: number; vy: number; dmg: number; life: number }

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; grav: number; add: boolean;
}

interface Gem {
  x: number; y: number; vx: number; vy: number; val: number;
  /** bob-animation phase, randomized at spawn — not an age, see `age` for that */
  t: number;
  /** seconds since spawn — despawns at GEM_LIFETIME if never collected */
  age: number;
  rest: boolean; kind: "xp" | "scrap";
}
interface FloatText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number }
interface Decal { x: number; y: number; s: number; a: number }
interface SpawnItem { type: ZType; boss?: boolean }
interface Banner { text: string; sub: string; t: number; dur: number }
// kind 0 stone-a 1 stone-b 2 tree 3 lamp 4 wrecked car 5 barrier 6 rubble pile
interface Decor { x: number; y: number; kind: number; s: number; ph: number }
/** Solid-collision radius per decor kind (world units, scaled by the decor's own `s`).
 * 0 means walk-through — just the lamp post's thin light pole. */
const DECOR_SOLID_R = [11, 13, 16, 0, 18, 14, 16];
interface Crate { x: number; y: number; tier: CrateTier; opened: boolean }
interface GrenadeProj { x: number; y: number; vx: number; vy: number; fuse: number }

/* ------------------------------------------------------------------ */
/* engine                                                              */
/* ------------------------------------------------------------------ */

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onEvent: (e: EngineEvent) => void;
  readonly sfx = new Sfx();
  private debug = new URLSearchParams(window.location.search).get("debug") === "1";

  private stageDef: StageDef = stageDefFor(1);
  private worldW = this.stageDef.worldW;
  private theme: ThemeDef = THEMES[this.stageDef.themeId];

  private raf = 0;
  private last = 0;
  private tGlobal = 0;

  mode: "attract" | "play" = "attract";
  /** persistent lifetime progression — loaded once, survives every run in this session */
  private profile: ProfileData = loadProfile();
  private over = false;
  private paused = false;
  private modals = new Set<ModalKind>();
  private get modalOpen() {
    return this.modals.size > 0;
  }

  private keys = new Set<string>();
  private mouse = { x: W / 2, y: 300, down: false };

  // world state
  private cam = 0;
  private camY = 0; // top-down camera Y position
  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;

  private pl = this.freshPlayer();
  private st = this.baseStats();
  private stacks: Record<string, number> = {};
  /** weapons the player permanently owns */
  private owned = new Set<string>([STARTER]);
  /** which variant is selected within each class */
  private equipped: Partial<Record<WeaponClass, string>> = { pistol: STARTER };
  /** currently equipped weapon id */
  kind: string = STARTER;
  /** rounds currently in each weapon's magazine */
  private ammo: Record<string, number> = {};
  /** spare rounds per weapon (-1 = unlimited) */
  private reserve: Record<string, number> = {};
  private reloading = false;
  private reloadT = 0;
  private reloadDur = 0;

  /* --- targeting / fire mode --- */
  /** true = Automated Engagement, false = Manual Trigger */
  private autoFire = false;
  /** lane the player is locked to */
  private facing: 1 | -1 = 1;
  /** whatever the laser ray is currently crossing — a Zombie or the Boss, see acquireRayTarget() */
  private target: AimTarget | null = null;
  private onTarget = false;
  private laserFlash = 0;
  /** blocks fire() briefly after a lane flip; scaled by the weapon's pivotMul */

  /** re-entrancy guard so overlapping triggers can't stack ambushes */
  private ambushT = 0;

  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private eshots: EShot[] = [];
  private particles: Particle[] = [];
  private gems: Gem[] = [];
  private texts: FloatText[] = [];
  private decals: Decal[] = [];

  /* --- boss: The Juggernaut Alpha, spawned on each stage's mid-stage boss wave --- */
  private boss: Boss | null = null;
  /** where the boss's grave split open — a lasting visual scar, cleared on the next stage */
  private bossGrave: { x: number; y: number } | null = null;
  /** toggled by KeyE while the boss is alive — forces auto-aim onto it over a close add */
  private bossForceTarget = false;
  /** after any boss windup starts, regular lane-edge zombie spawns pause this long —
   * keeps the telegraph readable instead of a fresh walker wandering into frame mid-tell */
  private spawnSuppressT = 0;

  private power = 0;             // difficulty scalar, drives every balance formula
  private waveIndex = 0;         // monotonic global wave number, for display only
  private stage = 1;
  private waveInStage = 0;       // 1..stageDef.wavesPerStage
  private stageIntermission = false;
  private phase: "break" | "active" | "prep" = "break";
  private breakT = 0;
  private spawnT = 0;
  private queue: SpawnItem[] = [];
  private waveTotal = 0;
  /** >0 while a stage-5/10 horde finale is running — see HORDE_STAGES/HORDE_DURATION */
  private hordeT = 0;
  private hordeTotal = 0;

  /* --- inventory: fixed 4x4 backpack, a persistent safe-house stash, loot crates --- */
  private backpack: PlacedItem[] = [];
  private deposit: string[] = [];
  /** bumped on every backpack/deposit mutation — the UI polls this, not HudState */
  private invVer = 0;
  private nextItemSeq = 1;
  private crates: Crate[] = [];
  /** hold-to-open progress (seconds held) on whichever crate is currently in range */
  private crateOpenT = 0;
  private grenades: GrenadeProj[] = [];
  /** active Tactical Stim buff remaining, seconds */
  private stimT = 0;

  /* --- arena (stage 4): prep phase, deployables, scrap --- */
  private deployables: Deployable[] = [];
  private nextDeployableSeq = 1;
  private placingKind: DeployableKind | null = null;
  private prepT = 0;
  /** RepairPanel is shown while this is > 0, ticking down from 12s each prep phase */
  private repairWindowT = 0;
  private scrap = 0;

  private score = 0;
  private kills = 0;
  private playTime = 0;
  private lvlPending = 0;
  private banners: Banner[] = [];
  private ambientT = 0;
  private moteT = 0;
  private high = 0;

  // decor
  private decor: Decor[] = [];
  private tufts: { x: number; y: number; h: number; s: number }[] = [];

  constructor(canvas: HTMLCanvasElement, onEvent: (e: EngineEvent) => void) {
    this.canvas = canvas;
    this.onEvent = onEvent;
    this.ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.high = Number(localStorage.getItem("graveyard-shift-high") || 0);
    this.sfx.setVolume(loadSettings().volume);
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
    this.recompute();
    this.pl.hp = this.st.maxHp;
    this.mode = "play";
    this.phase = "break";
    this.breakT = 2.2;
    this.announce(`STAGE 1 — ${this.stageDef.name}`, this.stageDef.sub, 2.6);
  }

  toMenu() {
    // flush this run's lifetime meta-progress — it's otherwise only persisted
    // at stage-clear/death, so quitting mid-stage would silently drop it
    saveProfile(this.profile);
    this.reset();
    this.mode = "attract";
    this.cam = 0;
  }

  /** Loadout screen: picks which owned weapon a class starts equipped with next run.
   * Persists immediately — this is lifetime progression, not per-run state. */
  setLoadout(weaponId: string) {
    const w = WDEF[weaponId];
    if (!w || !isWeaponUnlocked(weaponId, this.profile.metaLevel)) return;
    this.profile.equipped = { ...this.profile.equipped, [w.cls]: weaponId };
    saveProfile(this.profile);
  }

  /** Loadout + Profile screen data — read-only snapshot, polled separately from HudState. */
  getProfile(): ProfileSnapshot {
    return {
      metaLevel: this.profile.metaLevel,
      metaXp: this.profile.metaXp,
      metaXpNext: metaXpFor(this.profile.metaLevel),
      totalKills: this.profile.totalKills,
      bestWave: this.profile.bestWave,
      totalScrap: this.profile.totalScrap,
      equipped: { ...this.profile.equipped },
      weaponXp: { ...this.profile.weaponXp },
      equippedAttachment: { ...this.profile.equippedAttachment },
    };
  }

  /** Weapon-mastery attachment picker — validates the level is actually
   * unlocked before equipping, same guard pattern as equip()/setLoadout(). */
  equipAttachment(weaponId: string, attachmentId: AttachmentId | null) {
    if (attachmentId) {
      const xp = this.profile.weaponXp[weaponId] ?? 0;
      const unlocked = unlockedAttachments(xp).some((a) => a.id === attachmentId);
      if (!unlocked) return;
    }
    this.profile.equippedAttachment[weaponId] = attachmentId;
    saveProfile(this.profile);
  }

  /** Base weapon stats with its equipped attachment's modifiers applied —
   * every gameplay-affecting read of a weapon's mag/reload/reserve/range/
   * swap should go through this, not WDEF[id] directly. */
  private effWeapon(kind: string): WeaponDef {
    const base = WDEF[kind] ?? WDEF.pistol;
    const att = this.profile.equippedAttachment[kind] as AttachmentId | null | undefined;
    return applyAttachment(base, att);
  }

  private gainWeaponXp(kind: string, v: number) {
    const before = weaponLevelFor(this.profile.weaponXp[kind] ?? 0);
    this.profile.weaponXp[kind] = (this.profile.weaponXp[kind] ?? 0) + v;
    const after = weaponLevelFor(this.profile.weaponXp[kind]);
    if (after > before) {
      const unlocked = ATTACHMENT_ORDER[after - 1];
      this.announce("ATTACHMENT UNLOCKED", `${unlocked.name} — ${WDEF[kind]?.name ?? kind}`, 2.4);
    }
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

  getVolume() {
    return this.sfx.getVolume();
  }

  /** Settings-screen volume slider — persists immediately, separate from the quick mute toggle. */
  setVolume(v: number) {
    this.sfx.setVolume(v);
    saveSettings({ ...loadSettings(), volume: v });
  }

  /* ---------------- setup ---------------- */

  private freshPlayer() {
    return {
      x: this.worldW / 2, y: WORLD_H / 2, vx: 0, vy: 0,
      hp: 100, level: 1, xp: 0, xpNext: 12,
      face: 1, aim: 0, cd: 0, ifr: 0, flash: 0, hurtT: 0,
      dashT: 0, dashCd: 0, dashDir: 1,
      walk: 0,
      /** blocks fire() while > 0 — consumable "use" animation lockout */
      useT: 0,
    };
  }

  private baseStats() {
    return {
      damage: 13, fireRate: 3.1, bulletSpeed: 800, jitter: 0.02,
      projectiles: 1, projSpread: 0, projJitter: 1,
      pierce: 0, crit: 0.05,
      speed: 275, maxHp: 100, magnet: 1, lifesteal: 0,
      regen: 0, dashMax: 2.3,
    };
  }

  private reset() {
    this.power = 0;
    this.waveIndex = 0;
    this.setStage(1);
    this.pl = this.freshPlayer();
    this.st = this.baseStats();
    this.stacks = {};
    // ownership is a function of lifetime meta level, not run state — every
    // weapon unlocked so far is available from the start of every run
    this.owned = new Set<string>(ownedWeaponsForLevel(this.profile.metaLevel));
    this.equipped = {};
    for (const cls of CLASS_ORDER) {
      const pick = this.profile.equipped[cls];
      if (pick && this.owned.has(pick)) this.equipped[cls] = pick;
    }
    this.kind = this.equipped.pistol ?? STARTER;
    this.ammo = {};
    this.reserve = {};
    for (const id of WEAPON_IDS) {
      const w = this.effWeapon(id);
      this.ammo[id] = w.mag;
      this.reserve[id] = w.reserve;
    }
    this.reloading = false;
    this.reloadT = 0;
    this.reloadDur = 0;
    this.autoFire = false;
    this.facing = 1;
    this.target = null;
    this.onTarget = false;
    this.ambushT = 0;
    this.laserFlash = 0;
    this.zombies = [];
    this.bullets = [];
    this.eshots = [];
    this.particles = [];
    this.gems = [];
    this.texts = [];
    this.decals = [];
    this.boss = null;
    this.bossForceTarget = false;
    this.spawnSuppressT = 0;
    this.waveInStage = 0;
    this.stageIntermission = false;
    this.waveTotal = 0;
    this.queue = [];
    this.backpack = [];
    this.deposit = [];
    this.invVer++;
    this.crates = [];
    this.crateOpenT = 0;
    this.grenades = [];
    this.stimT = 0;
    this.deployables = [];
    this.placingKind = null;
    this.prepT = 0;
    this.repairWindowT = 0;
    this.scrap = 0;
    this.score = 0;
    this.kills = 0;
    this.playTime = 0;
    this.lvlPending = 0;
    this.banners = [];
    this.over = false;
    this.paused = false;
    this.modals.clear();
    this.cam = clamp(this.pl.x - W / 2, 0, this.worldW - W);
    this.mouse.x = W / 2;
    this.mouse.y = 280;
    // Clear held input so a key/fire state stuck by a touch gesture that never
    // saw its pointerup can't be inherited by a fresh run (death -> Restart).
    this.keys.clear();
    this.mouse.down = false;
  }

  /** Switches to a stage's def/world width/theme and regenerates decor to fit. */
  private setStage(stageNum: number) {
    this.stage = stageNum;
    this.stageDef = stageDefFor(stageNum);
    this.worldW = this.stageDef.worldW;
    this.theme = THEMES[this.stageDef.themeId];
    this.genDecor(this.theme, this.worldW);
    this.bossGrave = null;
  }

  private genDecor(theme: ThemeDef, worldW: number) {
    // stage transitions call this again — never accumulate across runs
    this.decor = [];
    this.tufts = [];
    this.theme = theme;
    // decor scattered across the full top-down play area (x AND y) — kind
    // weights vary per theme. Density is area-based so wide/tall stages
    // don't feel sparser or denser than the tuned reference stage.
    const weights = theme.decorWeights;
    const wTotal = weights.reduce((a, b) => a + b, 0) || 1;
    const area = worldW * WORLD_H;
    const decorCount = Math.round(area / 42000);
    // keep a clear patch around the stage's own spawn point (worldW/2, WORLD_H/2)
    // so a solid obstacle can never spawn on top of the player at stage start
    const spawnX = worldW / 2, spawnY = WORLD_H / 2;
    for (let i = 0; i < decorCount; i++) {
      let roll = Math.random() * wTotal;
      let kind = 0;
      for (let k = 0; k < weights.length; k++) {
        if ((roll -= weights[k]) < 0) { kind = k; break; }
      }
      let x = 0, y = 0;
      for (let tries = 0; tries < 5; tries++) {
        x = R(40, worldW - 40);
        y = R(40, WORLD_H - 40);
        if (Math.hypot(x - spawnX, y - spawnY) > 120) break;
      }
      this.decor.push({ x, y, kind, s: R(0.7, 1.25), ph: R(0, TAU) });
    }
    // ground tufts, scattered the same way (world coords, no parallax)
    const tuftCount = Math.round(area / 9000);
    for (let i = 0; i < tuftCount; i++) {
      this.tufts.push({ x: R(0, worldW), y: R(0, WORLD_H), h: R(5, 14), s: R(0.6, 1.3) });
    }
  }

  /** Solid decor (gravestones, wrecks, barriers, rubble, tree trunks) blocks
   * the player — pushes them back out along the shortest escape direction
   * instead of letting them walk straight through. Purely cosmetic decor
   * (the lamp post's thin pole) is excluded via a 0 radius in DECOR_SOLID_R. */
  private resolvePlayerObstacles() {
    const p = this.pl;
    const playerR = 13;
    for (const d of this.decor) {
      const solidR = DECOR_SOLID_R[d.kind] * d.s;
      if (solidR <= 0) continue;
      const dx = p.x - d.x, dy = p.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const min = solidR + playerR;
      if (dist < min) {
        const push = min - dist;
        p.x += (dx / dist) * push;
        p.y += (dy / dist) * push;
      }
    }
    p.x = clamp(p.x, 26, this.worldW - 26);
    p.y = clamp(p.y, 26, WORLD_H - 26);
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
    if (c === "ShiftLeft" || c === "ShiftRight") this.dash();
    // during arena prep, 1/2/3 pick a deployable tool instead of a weapon class
    if (c === "Enter" && this.phase === "prep") this.prepT = 0; // READY — skip the rest of prep
    if (c.startsWith("Digit")) {
      const i = Number(c.slice(5)) - 1;
      if (this.phase === "prep") {
        const kinds: DeployableKind[] = ["barricade", "wire", "claymore"];
        if (i >= 0 && i < kinds.length) this.selectDeployable(kinds[i]);
      } else if (i >= 0 && i < CLASS_ORDER.length) {
        this.selectClass(CLASS_ORDER[i]);
      }
    }
    // during a boss fight, E forces the lock onto it over a close add (crate/gate E is
    // a held check elsewhere in update(), so this discrete toggle never steals that input)
    if (c === "KeyE") this.toggleBossForceTarget();
    if (c === "KeyQ") this.cycleWeapon(1);
    if (c === "KeyR") this.startReload(true);
    if (c === "KeyF" || c === "KeyV") this.toggleFireMode();
    if (c === "KeyG") this.useConsumable("G");
    if (c === "KeyB") this.useConsumable("B");
    if (c === "KeyT") this.useConsumable("T");
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

  /** Converts a client-space point into the fixed logical canvas coordinate space,
   * accounting for the canvas being scaled to fit the viewport. Desktop-only — touch
   * input goes through triggerTap() instead, which no longer needs a live cursor. */
  private clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  }

  private onMouseMove = (e: MouseEvent) => {
    const p = this.clientToCanvas(e.clientX, e.clientY);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    this.sfx.ensure();
    if (this.mode === "play" && !this.over && !this.paused && !this.modalOpen && this.phase === "prep" && this.placingKind) {
      this.tryPlaceDeployable();
      return;
    }
    this.mouse.down = true;
    // Top-down mode: no pivoting, just aim toward mouse
  };

  toggleFireMode() {
    this.autoFire = !this.autoFire;
    this.sfx.click();
    this.texts.push({
      x: this.pl.x, y: this.pl.y - 92, vy: -46, life: 0.8, max: 0.8,
      text: this.autoFire ? "AUTO-FIRE ON" : "MANUAL TRIGGER",
      color: this.autoFire ? "#4ade80" : "#fbbf24", size: 13,
    });
  }

  private onMouseUp = () => (this.mouse.down = false);
  private onCtx = (e: Event) => e.preventDefault();

  /* ---------------- touch input (mirrors keyboard/mouse state) ---------------- */

  /** Marks a virtual key as held — same effect as a keydown for movement keys. */
  pressKey(code: string) {
    this.keys.add(code);
  }

  /** Releases a virtual key — same effect as a keyup. */
  releaseKey(code: string) {
    this.keys.delete(code);
  }

  /** Starts/stops continuous fire — same effect as holding/releasing the mouse button.
   * Only matters in manual-fire mode; auto-fire already engages on laser contact. */
  setFiring(down: boolean) {
    if (down) this.sfx.ensure();
    this.mouse.down = down;
  }

  /** Triggers a dash, respecting the same game-state guards as the keyboard handler. */
  triggerDash() {
    if (this.mode !== "play" || this.over || this.paused || this.modalOpen) return;
    this.sfx.ensure();
    this.dash();
  }

  /** Touch's tap-to-act — mirrors onMouseDown's full decision tree (place during prep,
   * else pivot the lane) from a raw client point instead of a live-tracked cursor. */
  triggerTap(clientX: number, clientY: number) {
    if (this.mode !== "play" || this.over || this.paused || this.modalOpen) return;
    this.sfx.ensure();
    const p = this.clientToCanvas(clientX, clientY);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    if (this.phase === "prep" && this.placingKind) {
      this.tryPlaceDeployable();
      return;
    }
    // Top-down: tap updates aim direction, no pivoting
  }

  /** KeyE (or its touch interact-button equivalent) while a boss is alive forces
   * the boss to win the laser-ray tie-break over a zombie — see acquireRayTarget(). */
  toggleBossForceTarget() {
    if (!this.boss || this.boss.dead) return;
    this.bossForceTarget = !this.bossForceTarget;
  }

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
    // Returns normalized direction in 2D for top-down movement
    const r = this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0;
    const l = this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0;
    const d = this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0;
    const u = this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0;
    const dx = r - l;
    const dy = d - u;
    // Return both X and Y components
    return { x: dx, y: dy };
  }

  private dash() {
    const p = this.pl;
    if (p.dashCd > 0) return;
    const stDash = this.stacks["dash"] || 0;
    p.dashCd = this.st.dashMax;
    p.dashT = 0.16 + 0.06 * stDash;
    const mov = this.inputDir();
    // In top-down, dash in direction of input or facing direction
    if (mov.x !== 0 || mov.y !== 0) {
      p.dashDir = Math.atan2(mov.y, mov.x);
    } else {
      p.dashDir = p.aim; // dash toward where player is aiming
    }
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
      const z = this.mkZombie(type, fromLeft ? -60 : W + 60, GROUND, 1, 1);
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
    p.cd -= dt; p.ifr -= dt; p.hurtT -= dt; p.flash -= dt; p.dashCd -= dt; p.useT -= dt;
    if (this.stimT > 0) this.stimT -= dt;

    // 2D movement (top-down)
    const mov = this.inputDir();
    if (p.dashT > 0) {
      p.dashT -= dt;
      const speed = 1350;
      p.vx = Math.cos(p.dashDir) * speed;
      p.vy = Math.sin(p.dashDir) * speed;
      const pdx = Math.cos(p.dashDir) * 10;
      const pdy = Math.sin(p.dashDir) * 10;
      this.particles.push({ x: p.x - pdx, y: p.y - pdy, vx: -pdx * R(3, 9), vy: -pdy * R(3, 9), life: 0.3, max: 0.3, size: R(4, 10), color: "#67e8f9", grav: 0, add: true });
    } else {
      // Tactical Stim: temporary speed rush
      const speed = this.st.speed * (this.stimT > 0 ? 1.35 : 1);
      const mag = Math.hypot(mov.x, mov.y);
      if (mag > 0) {
        const speedMul = speed / mag;
        p.vx = lerp(p.vx, mov.x * speedMul, Math.min(1, 14 * dt));
        p.vy = lerp(p.vy, mov.y * speedMul, Math.min(1, 14 * dt));
      } else {
        p.vx = lerp(p.vx, 0, Math.min(1, 14 * dt));
        p.vy = lerp(p.vy, 0, Math.min(1, 14 * dt));
      }
    }

    // Update position (no gravity in top-down)
    p.x = clamp(p.x + p.vx * dt, 26, this.worldW - 26);
    p.y = clamp(p.y + p.vy * dt, 26, WORLD_H - 26);
    this.resolvePlayerObstacles();

    // Animation: walk cycle based on velocity magnitude
    const vel = Math.hypot(p.vx, p.vy);
    p.walk += dt * (vel > 26 ? 10 + vel * 0.014 : 3);

    // Face direction based on movement or aim
    if (vel > 26) {
      p.face = Math.cos(Math.atan2(p.vy, p.vx)) > 0 ? 1 : -1;
    }
    // The mouse always points the flashlight/cone — you still have to look
    // toward a zombie to find it, in both fire modes. Auto-fire then snaps
    // the laser onto the nearest zombie inside that lit cone and fires by
    // itself; manual fire keeps the raw mouse direction and only "acquires"
    // a target if the exact ray crosses one (see acquireRayTarget), firing
    // only on click.
    const mouseAim = this.mouseAimAngle();
    if (this.autoFire) {
      const target = this.acquireConeTarget(mouseAim, FLASHLIGHT_HALF_ANGLE);
      const had = this.onTarget;
      if (target) {
        const isBoss = target === this.boss;
        const ty = isBoss ? target.y - 36 * target.scale : target.y;
        p.aim = Math.atan2(ty - p.y, target.x - p.x);
      } else {
        p.aim = mouseAim;
      }
      this.target = target;
      this.onTarget = target !== null;
      if (this.onTarget && !had) this.laserFlash = 0.25;
    } else {
      p.aim = mouseAim;
      this.acquireRayTarget(p.aim);
    }
    if (this.laserFlash > 0) this.laserFlash -= dt;

    // reload + auto-fire (all weapons are full-auto; rate differs per weapon)
    this.updateReload(dt);
    if (this.reloading) {
      // can't shoot mid-reload
    } else if (this.ammo[this.kind] <= 0) {
      this.startReload(); // auto reload the instant the mag runs dry
    } else if (p.cd <= 0 && p.useT <= 0) {
      // AUTO-FIRE ON: shoot only when a zombie is on the laser line.
      // AUTO-FIRE OFF: manual trigger via mouse.
      if (this.autoFire ? this.onTarget : this.mouse.down) this.fire();
    }
    if (this.ambushT > 0) this.ambushT -= dt;

    // regen
    if (this.st.regen > 0) p.hp = Math.min(this.st.maxHp, p.hp + this.st.regen * dt);

    this.updateCrates(dt);
    this.updateGrenades(dt);

    // waves / travel
    if (this.phase === "break") {
      if (!this.stageIntermission) {
        this.breakT -= dt;
        if (this.breakT <= 0) this.startWave(this.waveInStage + 1);
      }
    } else if (this.phase === "prep") {
      if (!this.stageIntermission) {
        this.prepT -= dt;
        if (this.repairWindowT > 0) this.repairWindowT = Math.max(0, this.repairWindowT - dt);
        if (this.prepT <= 0) this.startWave(this.waveInStage + 1);
      }
    } else if (this.phase === "active") {
      if (this.spawnSuppressT > 0) this.spawnSuppressT -= dt;
      this.spawnT -= dt;
      const cap = Math.min(42, 10 + this.power * 1.1);
      if (this.hordeT > 0) {
        // continuously refilled stream instead of a fixed queue — the horde
        // doesn't run out until its timer does, not when a batch is dead
        this.hordeT = Math.max(0, this.hordeT - dt);
        if (this.spawnSuppressT <= 0 && this.spawnT <= 0 && this.zombies.length < cap + 8) {
          this.spawnT = Math.max(0.16, 1.0 - this.power * 0.07);
          this.spawnZombie({ type: rollEnemy(this.zombieWeights(this.power)) as ZType });
        }
      } else if (this.spawnSuppressT <= 0 && this.spawnT <= 0 && this.queue.length > 0 && this.zombies.length < cap) {
        this.spawnT = Math.max(0.2, 1.15 - this.power * 0.08);
        const n = this.power >= 4 && this.queue.length > 2 && chance(0.45) ? 2 : 1;
        for (let i = 0; i < n && this.queue.length > 0; i++) this.spawnZombie(this.queue.shift()!);
      }
      if (this.hordeT <= 0 && this.queue.length === 0 && this.zombies.length === 0 && (!this.boss || this.boss.dead)) {
        this.score += 50 * this.power;
        if (this.waveInStage >= this.stageDef.wavesPerStage) {
          // clearing the last wave finishes the stage directly — no more
          // walk-to-the-safe-house corridor with gates to clear; that was a
          // side-scroller-era mechanic that doesn't fit open 2D exploration
          this.completeStage();
        } else {
          const boss = this.stageDef.bossWaves.includes(this.waveInStage);
          // exploration stages carry no bossWaves at all, so without this,
          // every mid-stage crate there would be stuck at tier 1 forever —
          // grenades (tier 2+) and stims (tier 3) need a periodic step up too
          const milestone = this.waveInStage % 5 === 0;
          this.beginRest(1.4);
          if (this.stageDef.fixedCamera) this.awardSupply(0.18, 0.6);
          else p.hp = Math.min(this.st.maxHp, p.hp + 12);
          this.spawnCrate(boss ? (chance(0.5) ? 3 : 2) : milestone ? 2 : 1);
          this.announce(
            `WAVE ${this.waveInStage} CLEARED`,
            `${this.stageDef.wavesPerStage - this.waveInStage} to go — breathe while you can`
          );
        }
      }
    }
    this.updateDeployables();

    this.updateZombies(dt);
    this.updateBoss(dt);
    this.updateBullets(dt);
    this.updateEshots(dt);
    this.updateGems(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);

    // decals fade
    for (const d of this.decals) d.a -= dt * 0.02;
    this.decals = this.decals.filter((d) => d.a > 0.05);

    // camera — top-down follows player position in 2D
    if (this.stageDef.fixedCamera) {
      this.cam = this.camOrigin();
      this.camY = 0;
    } else {
      const targetX = clamp(p.x - W / 2, 0, this.worldW - W);
      const targetY = clamp(p.y - H / 2, 0, WORLD_H - H);
      this.cam = lerp(this.cam, targetX, Math.min(1, 5 * dt));
      this.camY = lerp(this.camY, targetY, Math.min(1, 5 * dt));
    }
    this.shakeMag = Math.max(0, this.shakeMag - dt * 26);
    this.shakeX = R(-this.shakeMag, this.shakeMag);
    this.shakeY = R(-this.shakeMag, this.shakeMag) * 0.7;
  }

  /* ============ TARGETING: mouse-directed aim ============ */

  /** Pure mouse-directed aim angle. */
  private mouseAimAngle() {
    const p = this.pl;
    // mouse.x/y are canvas (screen-space) pixels, so add the camera's
    // world-space top-left corner to convert to world coordinates. No extra
    // -W/2/-H/2: that would only be correct if cam/camY always sat exactly
    // at worldW/2-ish, which they don't (they clamp at world edges).
    const mx = this.mouse.x + this.cam;
    const my = this.mouse.y + this.camY;
    return Math.atan2(my - p.y, mx - p.x);
  }

  /** Auto-fire mode: nearest zombie within range AND inside the flashlight
   * cone around `aim` (the raw mouse direction) — the player still has to
   * look roughly toward a target to find it, but doesn't need to line up
   * an exact ray once it's in view. The boss can steal the pick via
   * bossForceTarget, same idea as acquireRayTarget's tie-break. */
  private acquireConeTarget(aim: number, halfAngle: number): AimTarget | null {
    const p = this.pl;
    const w = this.effWeapon(this.kind);
    const range = w.range * (1 + 0.12 * (this.stacks["velo"] || 0));
    const angleDiff = (a: number) => {
      let d = Math.abs(a - aim) % TAU;
      if (d > Math.PI) d = TAU - d;
      return d;
    };
    let best: AimTarget | null = null;
    let bestD = Infinity;

    for (const z of this.zombies) {
      if (z.dead) continue;
      const dx = z.x - p.x, dy = z.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range || angleDiff(Math.atan2(dy, dx)) > halfAngle) continue;
      if (d < bestD) { bestD = d; best = z; }
    }

    const boss = this.boss;
    if (boss && !boss.dead && boss.state !== "emerge") {
      const dx = boss.x - p.x, dy = boss.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= range && angleDiff(Math.atan2(dy, dx)) <= halfAngle && (this.bossForceTarget || d < bestD)) {
        best = boss;
      }
    }
    return best;
  }

  /** Manual-fire mode: the laser is wherever the mouse points, and a target
   * is only "acquired" (for the hot-reticle highlight) if that exact ray
   * actually crosses a zombie or the boss — no auto-snap to the nearest one. */
  private acquireRayTarget(aim: number) {
    const p = this.pl;
    const w = this.effWeapon(this.kind);
    const range = w.range * (1 + 0.12 * (this.stacks["velo"] || 0));
    const dirX = Math.cos(aim), dirY = Math.sin(aim);
    let best: AimTarget | null = null;
    let bestProj = Infinity;

    for (const z of this.zombies) {
      if (z.dead) continue;
      const dx = z.x - p.x, dy = z.y - p.y;
      const proj = dx * dirX + dy * dirY; // distance along the aim ray
      if (proj <= 0 || proj > range) continue;
      const perp = Math.abs(dx * dirY - dy * dirX); // distance off the ray
      if (perp <= z.r + 10 && proj < bestProj) { bestProj = proj; best = z; }
    }

    const boss = this.boss;
    if (boss && !boss.dead && boss.state !== "emerge") {
      const dx = boss.x - p.x, dy = boss.y - p.y;
      const proj = dx * dirX + dy * dirY;
      if (proj > 0 && proj <= range) {
        const perp = Math.abs(dx * dirY - dy * dirX);
        // KeyE forces the boss to win over a zombie on the same ray, even
        // one nearer along it, instead of only stealing the lock when it's
        // strictly closest.
        if (perp <= boss.r + 10 && (this.bossForceTarget || proj < bestProj)) { bestProj = proj; best = boss; }
      }
    }

    const had = this.onTarget;
    this.target = best;
    this.onTarget = best !== null;
    if (this.onTarget && !had) this.laserFlash = 0.25;
  }

  /* ============ AMBUSH ============ */

  /** Spawn Runners from random directions — triggered by Screamer's shriek, boss's Screaming
   * Call, camping in place too long, or a hazard. */
  private triggerAmbush(count: number) {
    this.ambushT = 6;
    for (let i = 0; i < count; i++) {
      // Omnidirectional ambush spawn
      const angle = Math.random() * TAU;
      const dist = 400;
      const x = clamp(this.pl.x + Math.cos(angle) * dist, 22, this.worldW - 22);
      const y = clamp(this.pl.y + Math.sin(angle) * dist, 22, WORLD_H - 22);
      const z = this.mkZombie("runner", x, y, 1 + (this.power - 1) * 0.2, 1.25);
      z.face = x > this.pl.x ? -1 : 1;
      this.zombies.push(z);
      for (let k = 0; k < 8; k++)
        this.particles.push({
          x, y, vx: Math.cos(angle) * R(40, 80), vy: Math.sin(angle) * R(40, 80),
          life: R(0.3, 0.6), max: 0.6,
          size: R(2, 5), color: "#7f1d1d", grav: 0, add: false,
        });
    }
    this.announce("THEY HEARD YOU", "runners closing from behind");
    this.sfx.wave();
    this.shake(5);
  }

  /** Begin a reload if it makes sense to. */
  startReload(manual = false) {
    const w = this.effWeapon(this.kind);
    if (this.reloading) return;
    if (this.ammo[this.kind] >= w.mag) {
      if (manual) this.sfx.click();
      return;
    }
    // limited reserve weapons need spare rounds (pistols are unlimited)
    if (this.reserve[this.kind] === 0) {
      // a class-typed ammo box in the backpack auto-loads before giving up
      const boxInst = this.backpack.find((it) => ITEMS[it.itemId]?.ammoClass === w.cls);
      if (boxInst) {
        const def = ITEMS[boxInst.itemId];
        this.backpack = removeItem(this.backpack, boxInst.id);
        this.invVer++;
        this.reserve[this.kind] = def.ammoAmount ?? 0;
        this.texts.push({
          x: this.pl.x, y: this.pl.y - 88, vy: -46, life: 0.8, max: 0.8,
          text: `+${def.ammoAmount} RESERVE`, color: "#67e8f9", size: 12,
        });
      } else {
        if (manual) {
          this.sfx.dryFire();
          this.texts.push({
            x: this.pl.x, y: this.pl.y - 88, vy: -46, life: 0.9, max: 0.9,
            text: "NO RESERVE AMMO", color: "#f87171", size: 12,
          });
        }
        return;
      }
    }
    this.reloading = true;
    this.reloadDur = w.reload;
    this.reloadT = w.reload;
    this.sfx.reloadStart();
    // eject spent magazine
    const p = this.pl;
    this.particles.push({
      x: p.x, y: p.y - 40, vx: -p.face * R(40, 90), vy: R(-40, 10),
      life: 0.7, max: 0.7, size: 3, color: "#78716c", grav: 1400, add: false,
    });
  }

  private finishReload() {
    const w = this.effWeapon(this.kind);
    const need = w.mag - this.ammo[this.kind];
    if (this.reserve[this.kind] < 0) {
      this.ammo[this.kind] = w.mag; // unlimited reserve (pistols)
    } else {
      const take = Math.min(need, this.reserve[this.kind]);
      this.ammo[this.kind] += take;
      this.reserve[this.kind] -= take;
    }
    this.reloading = false;
    this.reloadT = 0;
    this.sfx.reloadEnd();
    this.texts.push({
      x: this.pl.x, y: this.pl.y - 78, vy: -46, life: 0.7, max: 0.7,
      text: "RELOADED", color: "#fbbf24", size: 12,
    });
  }

  private updateReload(dt: number) {
    if (!this.reloading) return;
    this.reloadT -= dt;
    if (this.reloadT <= 0) this.finishReload();
  }

  private fire() {
    const p = this.pl;
    const st = this.st;
    const w = this.effWeapon(this.kind);
    // out of ammo -> auto reload
    if (this.ammo[this.kind] <= 0) {
      this.sfx.dryFire();
      this.startReload();
      p.cd = 0.25;
      return;
    }
    this.ammo[this.kind]--;
    // Tactical Stim: temporary fire-rate rush
    p.cd = 1 / (st.fireRate * (this.stimT > 0 ? 1.4 : 1));
    p.flash = 0.07;
    // eject a spent casing
    this.particles.push({
      x: p.x - Math.cos(p.aim) * 4, y: p.y,
      vx: -p.face * R(60, 150), vy: R(-210, -150),
      life: 0.6, max: 0.6, size: 1.8, color: "#fbbf24", grav: 1500, add: false,
    });
    const n = st.projectiles;
    const base = p.aim;
    const wc = WDEF[this.kind].cls;
    const muzzle = wc === "carbine" ? 58 : wc === "smg" ? 48 : 46;
    // no more "-40 shoulder height" — bullets spawn from the player's real
    // top-down position, same origin the laser sight and the drawn gun use
    const mzx = p.x + Math.cos(base) * muzzle;
    const mzy = p.y + Math.sin(base) * muzzle;
    const spread = st.projSpread;
    const jit = st.jitter;
    for (let i = 0; i < n; i++) {
      const off = n > 1 ? (i - (n - 1) / 2) * spread : 0;
      const a = base + off + R(-jit, jit);
      const crit = chance(st.crit);
      this.bullets.push({
        x: mzx, y: mzy,
        vx: Math.cos(a) * st.bulletSpeed, vy: Math.sin(a) * st.bulletSpeed,
        dmg: st.damage * (crit ? 2.2 : 1) * R(0.92, 1.08),
        pierce: st.pierce, crit,
        // bullets expire at the weapon's effective range
        life: (w.range * (1 + 0.12 * (this.stacks["velo"] || 0))) / st.bulletSpeed,
        hits: new Set(),
        hitBoss: false,
      });
    }
    for (let i = 0; i < 5; i++)
      this.particles.push({ x: mzx, y: mzy, vx: Math.cos(base + R(-0.5, 0.5)) * R(120, 420), vy: Math.sin(base + R(-0.5, 0.5)) * R(120, 420), life: R(0.08, 0.16), max: 0.16, size: R(1.5, 3.5), color: chance(0.5) ? "#fde68a" : "#f59e0b", grav: 0, add: true });
    this.particles.push({ x: p.x - Math.cos(base) * 4, y: p.y, vx: -p.face * R(50, 130), vy: R(-190, -140), life: 0.55, max: 0.55, size: 2, color: "#fbbf24", grav: 1500, add: false });
    // recoil pushes back along the full 2D aim direction now, not just x
    p.vx -= Math.cos(base) * (w.recoil * 0.55);
    p.vy -= Math.sin(base) * (w.recoil * 0.55);
    this.shake(w.shake);
    this.sfx.shoot();
  }

  private updateZombies(dt: number) {
    const p = this.pl;
    const movingFast = Math.abs(p.vx) > 220;
    const arena = this.stageDef.fixedCamera;
    const centerX = this.worldW / 2;
    for (const z of this.zombies) {
      z.t += dt;
      z.flash -= dt;
      if (z.dormant) {
        // sleepers wake when the player passes close while running/dashing
        const near = Math.abs(p.x - z.x) < 90;
        if (near && movingFast) this.wakeZombie(z);
        else continue; // still asleep — no movement, no attack timer, no contact damage
      }
      // the Screamer: crossing her path starts a windup; if she's still alive
      // when it expires she shrieks and triggers an ambush — a second Screamer
      // mid-ambush can't stack one, the ambushT guard is already shared
      if (z.type === "screamer" && z.alertT >= 0) {
        if (z.alertT === 0) {
          const close = Math.abs(p.x - z.x) < 260 && Math.abs(p.y - z.y) < 90;
          if (close) z.alertT = 1.4;
        } else {
          z.alertT -= dt;
          if (z.alertT <= 0) {
            z.alertT = -1; // spent — a killed-or-survived Screamer never re-triggers
            if (this.ambushT <= 0) this.triggerAmbush(3);
          }
        }
      }
      z.atk -= dt;
      if (z.slowT > 0) z.slowT -= dt;
      if (z.burnT > 0) {
        z.burnT -= dt;
        z.hp -= z.burnDps * dt;
        if (chance(0.3)) {
          this.particles.push({
            x: z.x + R(-6, 6), y: z.y - 10 * z.scale, vx: R(-20, 20), vy: R(-60, -20),
            life: R(0.2, 0.4), max: 0.4, size: R(2, 3), color: "#f97316", grav: -50, add: true,
          });
        }
        if (z.hp <= 0) { this.killZombie(z, z.face); continue; }
      }
      const dx = p.x - z.x;
      const dy = p.y - z.y;
      const dir = dx > 0 ? 1 : -1;
      z.face = dir;
      // 2D chase direction for the open top-down stages — the arena keeps
      // its own x-only lane approach (fixedCamera below), so this is unused there
      const dist2d = Math.hypot(dx, dy) || 1;
      const ux = dx / dist2d, uy = dy / dist2d;

      // arena barricades: melee zombies stop at the nearest one still ahead of
      // them and tear it down instead of reaching the player; spitters ignore
      // it entirely — their lobbed attack arcs over the wall
      let wall: Deployable | null = null;
      if (arena && z.type !== "spitter") {
        const side: 1 | -1 = z.x > centerX ? 1 : -1;
        let bestDist = Infinity;
        for (const d of this.deployables) {
          if (d.kind !== "barricade" || d.hp <= 0 || d.lane !== side) continue;
          const wx = slotToWorldX(d.lane, d.slot, centerX);
          const ahead = side === 1 ? wx < z.x : wx > z.x;
          if (!ahead) continue;
          const wd = Math.abs(wx - z.x);
          if (wd < bestDist) { bestDist = wd; wall = d; }
        }
      }
      z.blockedBy = wall ? wall.id : null;

      if (z.type === "spitter") {
        if (arena) {
          // unchanged: the arena is a fixed x-lane approach by design
          const ad = Math.abs(dx);
          if (ad > 400) z.vx = dir * z.speed;
          else if (ad < 230) z.vx = -dir * z.speed * 0.6;
          else z.vx *= 0.85;
        } else {
          // keep-away kiting, now in full 2D instead of x-only
          if (dist2d > 400) { z.vx = ux * z.speed; z.vy = uy * z.speed; }
          else if (dist2d < 230) { z.vx = -ux * z.speed * 0.6; z.vy = -uy * z.speed * 0.6; }
          else { z.vx *= 0.85; z.vy *= 0.85; }
        }
        z.spit -= dt;
        if (z.spit <= 0 && (arena ? Math.abs(dx) : dist2d) < 640) {
          z.spit = R(2.1, 3.1);
          this.spitAt(z);
        }
      } else if (wall) {
        const wx = slotToWorldX(wall.lane, wall.slot, centerX);
        z.vx = lerp(z.vx, (wall.lane === 1 ? -1 : 1) * z.speed * 0.4, Math.min(1, 6 * dt));
        z.x = clamp(z.x + z.vx * dt, wall.lane === 1 ? wx : 10, wall.lane === 1 ? this.worldW - 10 : wx);
        if (z.atk <= 0) {
          z.atk = 0.6;
          wall.hp = Math.max(0, wall.hp - z.dmg * 1.4);
          this.texts.push({ x: wx, y: GROUND - 60, vy: -40, life: 0.4, max: 0.4, text: "-" + Math.round(z.dmg * 1.4), color: "#f87171", size: 11 });
          if (wall.hp <= 0) {
            this.deployables = this.deployables.filter((d) => d.id !== wall!.id);
            this.shake(3);
          }
        }
      } else {
        const speedMul = z.slowT > 0 ? 0.4 : 1;
        if (arena) {
          // unchanged: the arena is a fixed x-lane approach by design
          z.vx = lerp(z.vx, dir * z.speed * speedMul, Math.min(1, 6 * dt));
        } else {
          // open stages: chase the player in full 2D instead of x-only
          z.vx = lerp(z.vx, ux * z.speed * speedMul, Math.min(1, 6 * dt));
          z.vy = lerp(z.vy, uy * z.speed * speedMul, Math.min(1, 6 * dt));
        }
      }
      if (!wall) {
        z.x = clamp(z.x + z.vx * dt, 10, this.worldW - 10);
        if (!arena) z.y = clamp(z.y + z.vy * dt, 22, WORLD_H - 22);
      }

      // razor wire — no collision, just slows anything that crosses it
      if (arena) {
        for (const d of this.deployables) {
          if (d.kind !== "wire" || d.hp <= 0) continue;
          const wx = slotToWorldX(d.lane, d.slot, centerX);
          if (Math.abs(wx - z.x) < 22) z.slowT = 0.4;
        }
      }

      // contact damage (blocked zombies are busy with the wall, not the player)
      if (!wall && Math.abs(dx) < z.r + 15 && Math.abs(p.y - z.y) < 56 && z.atk <= 0) {
        z.atk = z.type === "brute" ? 1.15 : 0.8;
        this.hurtPlayer(z.dmg * R(0.9, 1.1), dir * (z.type === "brute" ? 300 : 150));
      }
    }
    // separation — full 2D outside the arena, where y now actually varies;
    // in the arena, dy stays 0 so this reduces to the original x-only push
    const zs = this.zombies;
    for (let i = 0; i < zs.length; i++) {
      for (let j = i + 1; j < zs.length; j++) {
        const a = zs[i], b = zs[j];
        const sdx = b.x - a.x;
        const sdy = arena ? 0 : b.y - a.y;
        const sepDist = Math.hypot(sdx, sdy) || 1;
        const min = (a.r + b.r) * 0.72;
        if (sepDist < min) {
          const push = (min - sepDist) * 0.5;
          const sux = sdx / sepDist, suy = sdy / sepDist;
          a.x -= sux * push;
          b.x += sux * push;
          if (!arena) { a.y -= suy * push; b.y += suy * push; }
        }
      }
    }
    this.zombies = zs.filter((z) => !z.dead);
  }

  private static readonly BOSS_PITCH: Record<BossAttack, number> = { slam: 90, mortar: 260, call: 170, shieldcharge: 130 };

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || b.dead) return;
    const p = this.pl;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.hurtT = Math.max(0, b.hurtT - dt);
    b.phase = phaseFor(b.hp / b.maxHp);
    const dx = p.x - b.x;
    b.face = dx >= 0 ? 1 : -1;

    if (b.state === "emerge") {
      // invulnerable and immobile while it rises — see drawBoss() for the
      // visual, and updateBullets()/targeting for why it can't be hit or
      // locked onto yet
      b.timer -= dt;
      if (chance(0.35)) {
        this.particles.push({
          x: b.x + R(-20, 20), y: b.y, vx: R(-30, 30), vy: R(-140, -60),
          life: R(0.3, 0.6), max: 0.6, size: R(2, 4), color: "#1c1712", grav: 400, add: false,
        });
      }
      if (b.timer <= 0) {
        b.state = "seek";
        b.timer = R(1, 1.8);
      }
      return;
    }

    const def = BOSS_DEFS[b.defId];
    if (b.state === "seek" || b.state === "cooldown") {
      b.vx = lerp(b.vx, Math.sign(dx || 1) * 68, Math.min(1, 4 * dt));
      b.x = clamp(b.x + b.vx * dt, 10, this.worldW - 10);
      b.timer -= dt;
      if (b.atk > 0) b.atk -= dt;
      else if (Math.abs(dx) < b.r + 18 && Math.abs(p.y - b.y) < 56) {
        b.atk = 1.1;
        this.hurtPlayer(26 * (1 + (this.power - 1) * 0.05), Math.sign(dx || 1) * 260);
      }
      if (b.timer <= 0) {
        if (b.state === "seek") {
          b.attack = pickAttack(b.attack, def.attacks);
          b.state = "windup";
          b.timer = windupFor(b.attack, b.phase, def);
          this.spawnSuppressT = 2;
          if (b.attack === "mortar") { b.targetX = p.x; b.targetY = p.y; }
          this.sfx.bossWindup(Engine.BOSS_PITCH[b.attack]);
        } else {
          b.state = "seek";
          b.timer = R(0.6, 1.2);
        }
      }
    } else if (b.state === "windup") {
      b.vx = 0;
      b.timer -= dt;
      if (b.timer <= 0) {
        this.executeBossAttack(b);
        b.state = "cooldown";
        b.timer = cooldownFor(b.phase, def);
      }
    }
  }

  private executeBossAttack(b: Boss) {
    const p = this.pl;
    const centerX = this.worldW / 2;
    if (b.attack === "slam") {
      const radius = 150;
      this.sfx.bossSlam();
      this.shake(11);
      const dx = p.x - b.x;
      if (Math.abs(dx) < radius && Math.abs(p.y - b.y) < 90) {
        this.hurtPlayer(32 * (1 + (this.power - 1) * 0.05), Math.sign(dx || 1) * 340);
      }
      for (const d of this.deployables) {
        const wx = slotToWorldX(d.lane, d.slot, centerX);
        if (Math.abs(wx - b.x) < radius) d.hp = Math.max(0, d.hp - d.maxHp * 0.6);
      }
      this.deployables = this.deployables.filter((d) => d.hp > 0);
      for (let i = 0; i < 26; i++)
        this.particles.push({
          x: b.x + R(-radius, radius), y: GROUND, vx: R(-100, 100), vy: R(-160, -20),
          life: R(0.3, 0.6), max: 0.6, size: R(2, 5), color: "#7a6a52", grav: 900, add: false,
        });
    } else if (b.attack === "mortar") {
      const radius = 95;
      this.sfx.hurt();
      const dx = b.targetX - p.x, dy = b.targetY - p.y;
      if (dx * dx + dy * dy < radius * radius) {
        this.hurtPlayer(27 * (1 + (this.power - 1) * 0.05), Math.sign(-dx || 1) * 260);
      }
      for (const d of this.deployables) {
        const wx = slotToWorldX(d.lane, d.slot, centerX);
        if (Math.abs(wx - b.targetX) < radius) d.hp = Math.max(0, d.hp - d.maxHp * 0.6);
      }
      this.deployables = this.deployables.filter((d) => d.hp > 0);
      for (let i = 0; i < 20; i++)
        this.particles.push({
          x: b.targetX + R(-30, 30), y: GROUND, vx: R(-140, 140), vy: R(-220, -40),
          life: R(0.3, 0.65), max: 0.65, size: R(2, 5), color: "#65a30d", grav: 900, add: true,
        });
    } else if (b.attack === "shieldcharge") {
      // The Neighborhood Watch's signature move — same melee-AOE-and-knockback
      // shape as Ground Slam, just a tighter radius (a forward charge, not an
      // omnidirectional ground pound) and its own tell color. No new physics.
      const radius = 110;
      this.sfx.bossSlam();
      this.shake(9);
      const dx = p.x - b.x;
      if (Math.abs(dx) < radius && Math.abs(p.y - b.y) < 90) {
        this.hurtPlayer(30 * (1 + (this.power - 1) * 0.05), Math.sign(dx || 1) * 320);
      }
      for (const d of this.deployables) {
        const wx = slotToWorldX(d.lane, d.slot, centerX);
        if (Math.abs(wx - b.x) < radius) d.hp = Math.max(0, d.hp - d.maxHp * 0.6);
      }
      this.deployables = this.deployables.filter((d) => d.hp > 0);
      for (let i = 0; i < 20; i++)
        this.particles.push({
          x: b.x + R(-radius, radius), y: GROUND, vx: R(-100, 100), vy: R(-160, -20),
          life: R(0.3, 0.6), max: 0.6, size: R(2, 5), color: "#38bdf8", grav: 900, add: false,
        });
    } else {
      // Screaming Call — reuses the existing runner-ambush system rather than
      // rebuilding add-spawning; "one active ambush max" falls out for free
      this.sfx.bossRoar();
      if (this.ambushT <= 0) this.triggerAmbush(2);
    }
  }

  private hitBoss(b: Boss, bullet: Bullet) {
    b.hp -= bullet.dmg;
    b.flash = 0.09;
    b.hurtT = 0.3;
    const dir = Math.sign(bullet.vx);
    for (let i = 0; i < (bullet.crit ? 8 : 5); i++)
      this.particles.push({ x: bullet.x, y: bullet.y, vx: dir * R(30, 190) + R(-60, 60), vy: R(-130, 40), life: R(0.25, 0.5), max: 0.5, size: R(2, 4.5), color: BLOOD[RI(0, BLOOD.length - 1)], grav: 1100, add: false });
    this.texts.push({ x: b.x + R(-8, 8), y: b.y - 100 * b.scale, vy: -60, life: 0.55, max: 0.55, text: String(Math.round(bullet.dmg)), color: bullet.crit ? "#fbbf24" : "rgba(255,255,255,.8)", size: bullet.crit ? 17 : 12 });
    if (this.st.lifesteal > 0) this.pl.hp = Math.min(this.st.maxHp, this.pl.hp + bullet.dmg * this.st.lifesteal);
    this.sfx.zhit();
    if (b.hp <= 0) this.killBoss(b);
  }

  private killBoss(b: Boss) {
    const def = BOSS_DEFS[b.defId];
    b.dead = true;
    b.hp = 0;
    this.kills++;
    this.score += Math.round(600 * (1 + this.power * 0.06));
    this.shake(12);
    this.sfx.zdie();
    this.gainXp(40);
    for (let i = 0; i < 40; i++)
      this.particles.push({ x: b.x + R(-10, 10), y: b.y - 60 * b.scale + R(-16, 16), vx: R(-160, 160), vy: R(-220, 60), life: R(0.3, 0.75), max: 0.75, size: R(2.5, 6), color: BLOOD[RI(0, BLOOD.length - 1)], grav: 1200, add: false });
    this.decals.push({ x: b.x, y: b.y, s: b.scale * 1.6, a: 0.6 });
    this.announce(def.deathBanner, def.deathSub, 2.6);
  }

  /** Rouses one sleeper. A loud wake (walking into a gate, a hazard) spreads to nearby sleepers too. */
  private wakeZombie(z: Zombie, spread = false) {
    if (!z.dormant) return;
    z.dormant = false;
    z.atk = R(0, 0.3);
    for (let i = 0; i < 5; i++)
      this.particles.push({
        x: z.x, y: z.y - 50 * z.scale, vx: R(-30, 30), vy: R(-50, -10),
        life: 0.4, max: 0.4, size: 2, color: "#fde047", grav: 0, add: true,
      });
    if (spread) {
      for (const other of this.zombies) {
        if (other !== z && other.dormant && Math.abs(other.x - z.x) < 220) this.wakeZombie(other);
      }
    }
  }

  private spitAt(z: Zombie) {
    const p = this.pl;
    const arena = this.stageDef.fixedCamera;
    // arena keeps its lobbed side-view arc (aimed above the "chest" with an
    // upward bias, then gravity brings it back down in updateEshots); the
    // open top-down stages fire straight at the player's actual position —
    // there's no "up" to lob into in a full 2D world
    const dx = p.x - z.x;
    const dy = arena ? (p.y - 40) - (z.y - 44 * z.scale) : p.y - z.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 330;
    const originY = arena ? z.y - 46 * z.scale : z.y;
    this.eshots.push({
      x: z.x, y: originY,
      vx: (dx / d) * sp, vy: (dy / d) * sp - (arena ? 60 : 0),
      dmg: z.dmg, life: 3,
    });
    this.sfx.spit();
    for (let i = 0; i < 4; i++)
      this.particles.push({ x: z.x, y: originY, vx: R(-40, 40), vy: arena ? R(-40, 10) : R(-40, 40), life: 0.3, max: 0.3, size: R(2, 4), color: "#a3e635", grav: 0, add: true });
  }

  private updateBullets(dt: number) {
    const arena = this.stageDef.fixedCamera;
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // arena only: a real ground line to kick up dust against. In the open
      // top-down stages the player can be anywhere in y, so despawning every
      // bullet that crosses a fixed height (previously unconditional here)
      // made shooting fail outright below that line — bullets now just expire
      // by their life timer or the world-bounds filter below instead
      if (arena && b.y > GROUND + 4) {
        b.life = 0;
        for (let i = 0; i < 3; i++)
          this.particles.push({ x: b.x, y: GROUND, vx: R(-60, 60), vy: R(-120, -40), life: 0.25, max: 0.25, size: 2, color: "#94a3b8", grav: 800, add: false });
        continue;
      }
      for (const z of this.zombies) {
        if (z.dead || b.hits.has(z)) continue;
        // top-down zombie body is centered at z.y directly now — no more
        // "chest height above feet" offset from the old standing side-view body
        const cy = z.y;
        const rr = z.r + 7;
        const dx = b.x - z.x, dy = b.y - cy;
        if (dx * dx + dy * dy < rr * rr * 1.25) {
          b.hits.add(z);
          // any hit on a still-dormant sleeper is a takedown, not a firefight
          if (z.dormant) this.quietKill(z);
          else this.hitZombie(z, b);
          if (b.pierce > 0) b.pierce--;
          else { b.life = 0; break; }
        }
      }
      if (b.life > 0 && this.boss && !this.boss.dead && this.boss.state !== "emerge" && !b.hitBoss) {
        const boss = this.boss;
        const cy = boss.y - 60 * boss.scale;
        const rr = boss.r + 7;
        const dx = b.x - boss.x, dy = b.y - cy;
        if (dx * dx + dy * dy < rr * rr * 1.25) {
          b.hitBoss = true;
          this.hitBoss(boss, b);
          if (b.pierce > 0) b.pierce--;
          else b.life = 0;
        }
      }
    }
    this.bullets = this.bullets.filter(
      (b) => b.life > 0 && b.x > -60 && b.x < this.worldW + 60 && b.y > -60 && b.y < WORLD_H + 60
    );
  }

  private updateEshots(dt: number) {
    const p = this.pl;
    const arena = this.stageDef.fixedCamera;
    for (const s of this.eshots) {
      s.life -= dt;
      if (arena) s.vy += 230 * dt; // unchanged: arena keeps its lobbed arc
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (chance(0.5))
        this.particles.push({ x: s.x, y: s.y, vx: R(-12, 12), vy: R(-12, 12), life: 0.3, max: 0.3, size: 2.4, color: "#84cc16", grav: 0, add: true });
      if (arena && s.y > GROUND + 2) { s.life = 0; continue; }
      const dx = s.x - p.x, dy = s.y - (arena ? p.y - 36 : p.y);
      if (dx * dx + dy * dy < 22 * 22) {
        s.life = 0;
        this.hurtPlayer(s.dmg, Math.sign(s.vx) * 110);
      }
    }
    this.eshots = this.eshots.filter((s) => s.life > 0);
  }

  private updateGems(dt: number) {
    const p = this.pl;
    const arena = this.stageDef.fixedCamera;
    const mr = 110 * this.st.magnet;
    for (const g of this.gems) {
      g.t += dt;
      g.age += dt;
      // no more -34 head offset — p.y is the player's own top-down center now,
      // not a feet position with the body drawn 34px above it
      const dx = p.x - g.x, dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < mr) {
        const pull = 620 * (1.15 - d / mr);
        g.vx = (dx / (d || 1)) * pull;
        g.vy = (dy / (d || 1)) * pull;
        g.rest = false;
      } else if (!g.rest && arena) {
        // unchanged: the arena is a side-view lane shooter with a real ground line
        g.vy += 1300 * dt;
        g.vx = lerp(g.vx, 0, Math.min(1, 4 * dt));
        if (g.y >= GROUND - 5) { g.y = GROUND - 5; g.vy *= -0.35; if (Math.abs(g.vy) < 30) { g.rest = true; g.vy = 0; g.vx = 0; } }
      } else if (!g.rest) {
        // top-down: no gravity, no fixed floor — the gem scatters from the
        // kill and settles wherever it lands instead of falling to a
        // universal ground height unrelated to where it dropped
        g.vx = lerp(g.vx, 0, Math.min(1, 4 * dt));
        g.vy = lerp(g.vy, 0, Math.min(1, 4 * dt));
        if (Math.hypot(g.vx, g.vy) < 8) { g.rest = true; g.vx = 0; g.vy = 0; }
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < 24) {
        g.val = -g.val; // mark collected
        if (g.kind === "scrap") {
          this.scrap += Math.abs(g.val);
          this.profile.totalScrap += Math.abs(g.val);
          this.gainMetaXp(2);
          this.particles.push({ x: p.x, y: p.y - 34, vx: R(-30, 30), vy: R(-60, -10), life: 0.3, max: 0.3, size: 3, color: "#94a3b8", grav: 0, add: true });
        } else {
          this.gainXp(Math.abs(g.val));
          this.particles.push({ x: p.x, y: p.y - 34, vx: R(-30, 30), vy: R(-60, -10), life: 0.3, max: 0.3, size: 3, color: "#a78bfa", grav: 0, add: true });
        }
        this.sfx.gem();
      }
    }
    this.gems = this.gems.filter((g) => g.val > 0 && g.age < GEM_LIFETIME);
  }

  private updateParticles(dt: number) {
    // arena only: a real ground line for gravity-affected particles to land
    // on. In the open top-down stages a kill can happen at any y, so bouncing
    // everything toward one fixed height made blood/debris drift toward a
    // line unrelated to where it actually happened — those now just arc
    // under gravity and fade out on their own life timer instead
    const arena = this.stageDef.fixedCamera;
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (arena && q.y > GROUND + 2 && q.grav > 0) { q.y = GROUND + 2; q.vy *= -0.3; q.vx *= 0.7; }
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
    // weapon-specific stagger (Deagle/shotguns hurl zombies backwards)
    const kb = WDEF[this.kind]?.knock ?? 60;
    z.vx += (Math.sign(b.vx) * kb * (b.crit ? 1.6 : 1)) / (z.scale * (z.boss ? 3 : 1));
    const dir = Math.sign(b.vx);
    for (let i = 0; i < (b.crit ? 8 : 5); i++)
      this.particles.push({ x: b.x, y: b.y, vx: dir * R(30, 190) + R(-60, 60), vy: R(-130, 40), life: R(0.25, 0.5), max: 0.5, size: R(2, 4.5), color: BLOOD[RI(0, BLOOD.length - 1)], grav: 1100, add: false });
    const dmgTextY = this.stageDef.fixedCamera ? z.y - 74 * z.scale : z.y - 18 * z.scale;
    this.texts.push({ x: z.x + R(-8, 8), y: dmgTextY, vy: -60, life: 0.55, max: 0.55, text: String(Math.round(b.dmg)), color: b.crit ? "#fbbf24" : "rgba(255,255,255,.8)", size: b.crit ? 17 : 12 });
    if (this.st.lifesteal > 0) this.pl.hp = Math.min(this.st.maxHp, this.pl.hp + b.dmg * this.st.lifesteal);
    this.sfx.zhit();
    const incendiary = this.stacks["incendiary"] || 0;
    if (incendiary > 0) {
      // refreshes on every hit rather than stacking additively — keeps
      // sustained fire on one target strong without compounding into an
      // unbounded DoT if you tag it repeatedly
      z.burnT = 3;
      z.burnDps = b.dmg * 0.25 * incendiary;
    }
    if (z.hp <= 0) this.killZombie(z, dir);
  }

  private killZombie(z: Zombie, dir: number) {
    z.dead = true;
    this.kills++;
    this.profile.totalKills++;
    this.gainMetaXp(1);
    this.gainWeaponXp(this.kind, 1);
    this.score += Math.round(z.score * (1 + this.power * 0.06));
    this.shake(z.type === "brute" ? 5 : 1.6);
    this.sfx.zdie();
    const arena = this.stageDef.fixedCamera;
    // arena keeps the old "chest height above feet" origin; the top-down
    // zombie body is flat, so its own y is already the right burst origin
    const cx = z.x, cy = arena ? z.y - 34 * z.scale : z.y;
    for (let i = 0; i < (z.boss ? 30 : 16); i++)
      this.particles.push({ x: cx + R(-8, 8), y: cy + R(-14, 14), vx: dir * R(20, 160) + R(-110, 110), vy: arena ? R(-200, 60) : R(-110, 110), life: R(0.3, 0.7), max: 0.7, size: R(2, 5.5), color: BLOOD[RI(0, BLOOD.length - 1)], grav: arena ? 1200 : 0, add: false });
    this.decals.push({ x: z.x, y: z.y, s: z.scale, a: 0.55 });
    if (this.decals.length > 70) this.decals.shift();
    // xp gems
    const total = z.xp;
    const n = Math.min(8, Math.max(1, Math.round(total)));
    for (let i = 0; i < n; i++) {
      const ang = R(0, TAU);
      this.gems.push({
        x: cx + R(-10, 10), y: cy,
        vx: arena ? R(-90, 90) : Math.cos(ang) * R(60, 150),
        vy: arena ? R(-220, -80) : Math.sin(ang) * R(60, 150),
        val: total / n, t: R(0, 9), age: 0, rest: false, kind: "xp",
      });
    }
    // scrap — feeds building/repairing deployables in the arena; endless only ever sees it there
    if (this.stageDef.fixedCamera && chance(0.22)) {
      this.gems.push({ x: cx + R(-10, 10), y: cy, vx: R(-90, 90), vy: R(-220, -80), val: 1, t: R(0, 9), age: 0, rest: false, kind: "scrap" });
    }
  }

  /** Bombardment upgrade — an instant, one-time strike wiping every regular
   * zombie currently alive. Spares anything boss-tier (the arena's Boss
   * entity is untouched by definition since it isn't in `zombies[]`, and a
   * `z.boss` mini-boss like a horde finale's brute is excluded here too) so
   * it can't trivialize the one fight in a wave meant to actually matter. */
  private executeBombardment() {
    for (const z of this.zombies) {
      if (z.dead || z.boss) continue;
      this.killZombie(z, z.face);
    }
    this.shake(16);
    this.sfx.zdie();
    for (let i = 0; i < 60; i++) {
      const ang = R(0, TAU);
      this.particles.push({
        x: this.pl.x + Math.cos(ang) * R(0, 260), y: this.pl.y + Math.sin(ang) * R(0, 260),
        vx: Math.cos(ang) * R(60, 220), vy: Math.sin(ang) * R(60, 220) - 40,
        life: R(0.4, 0.9), max: 0.9, size: R(3, 7), color: chance(0.5) ? "#f97316" : "#fde68a", grav: 0, add: true,
      });
    }
    this.announce("BOMBARDMENT", "the wave is cleared", 2.4);
  }

  /** A suppressed hit on a still-dormant sleeper — instant takedown, nearby sleepers stay asleep. */
  private quietKill(z: Zombie) {
    z.hp = 0;
    z.flash = 0.09;
    this.texts.push({
      x: z.x, y: z.y - 74 * z.scale, vy: -60, life: 0.6, max: 0.6,
      text: "QUIET KILL", color: "#67e8f9", size: 12,
    });
    this.killZombie(z, this.facing);
  }

  private hurtPlayer(dmg: number, kx: number) {
    const p = this.pl;
    if (p.ifr > 0 || p.dashT > 0 || this.over) return;
    // Body Armor — flat % reduction on every damage source that funnels
    // through here (zombie melee, spit, boss melee/ranged alike)
    dmg *= 1 - 0.08 * (this.stacks["armor"] || 0);
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
    this.shake(13);
    this.sfx.die();
    const p = this.pl;
    for (let i = 0; i < 40; i++)
      this.particles.push({ x: p.x, y: p.y - 34, vx: R(-260, 260), vy: R(-320, 40), life: R(0.4, 1), max: 1, size: R(2, 6), color: chance(0.6) ? BLOOD[RI(0, BLOOD.length - 1)] : "#0e7490", grav: 1100, add: false });
    this.profile.bestWave = Math.max(this.profile.bestWave, this.waveIndex);
    saveProfile(this.profile);
    // Decisions locked: restart at the last safe house, keep level/XP/upgrades/
    // weapons/deposit/progression, lose the carried backpack. Only a genuine
    // game-over (no checkpoint reached yet) ends the run.
    const checkpoint = loadRun();
    if (checkpoint) {
      this.retryStage(checkpoint);
      return;
    }
    this.over = true;
    const isBest = this.score > this.high;
    if (isBest) {
      this.high = this.score;
      localStorage.setItem("graveyard-shift-high", String(this.high));
    }
    const stats: GameStats = {
      stage: this.stage, wave: this.waveInStage, kills: this.kills, level: this.pl.level,
      score: this.score, time: this.playTime, best: this.high, isBest,
    };
    this.onEvent({ type: "gameover", stats });
  }

  /** reset() then restore progression from the last safe-house checkpoint. */
  private retryStage(checkpoint: SaveData) {
    this.reset();
    this.setStage(checkpoint.stage);
    this.pl.level = checkpoint.level;
    this.pl.xp = checkpoint.xp;
    this.pl.xpNext = checkpoint.xpNext;
    this.score = checkpoint.score;
    this.kills = checkpoint.kills;
    this.playTime = checkpoint.playTime;
    this.kind = this.owned.has(checkpoint.kind) ? checkpoint.kind : this.kind;
    this.stacks = { ...checkpoint.stacks };
    this.deposit = checkpoint.deposit;
    this.scrap = checkpoint.scrap ?? 0;
    // backpack is deliberately dropped — that's the whole point of the penalty
    this.backpack = [];
    this.invVer++;
    this.recompute();
    this.pl.hp = this.st.maxHp;
    this.pl.x = clamp(this.worldW * 0.12, 40, this.worldW - 40);
    this.pl.y = WORLD_H / 2;
    this.cam = this.stageDef.fixedCamera ? this.camOrigin() : clamp(this.pl.x - W / 2, 0, this.worldW - W);
    this.camY = clamp(this.pl.y - H / 2, 0, WORLD_H - H);
    this.mode = "play";
    this.beginRest(2.4);
    this.announce("YOU DIED", `back at the safe house — ${this.stageDef.name}`, 2.8);
  }

  private writeCheckpoint(nextStage: number) {
    const data: SaveData = {
      version: SAVE_VERSION, stage: nextStage,
      level: this.pl.level, xp: this.pl.xp, xpNext: this.pl.xpNext,
      score: this.score, kills: this.kills, playTime: this.playTime,
      kind: this.kind, stacks: { ...this.stacks }, deposit: this.deposit, backpack: this.backpack,
      scrap: this.scrap,
    };
    saveRun(data);
    this.profile.bestWave = Math.max(this.profile.bestWave, this.waveIndex);
    saveProfile(this.profile);
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

  /** Lifetime account progression — permanently unlocks weapons in the Loadout
   * screen as it climbs. Persisted at natural low-frequency checkpoints
   * (stage clear, death), not on every gain, to avoid a localStorage write per kill. */
  private gainMetaXp(v: number) {
    this.profile.metaXp += v;
    while (this.profile.metaXp >= metaXpFor(this.profile.metaLevel)) {
      this.profile.metaXp -= metaXpFor(this.profile.metaLevel);
      this.profile.metaLevel++;
      const unlocked = WEAPON_IDS.filter((id) => WEAPON_UNLOCK_LEVEL[id] === this.profile.metaLevel);
      for (const wid of unlocked) {
        this.owned.add(wid);
        this.announce("WEAPON UNLOCKED", `${WDEF[wid].name} — pick it in Loadout`, 2.6);
      }
    }
  }

  private openLevelModal() {
    this.modals.add("levelup");
    this.sfx.levelup();
    this.onEvent({ type: "levelup", choices: this.rollChoices() });
  }

  private rollChoices(): UpgradeChoice[] {
    // weapon ownership is entirely meta-level-gated now (see progression.ts) —
    // leveling up mid-run only ever offers stat upgrades, never a weapon
    const out: UpgradeChoice[] = [];
    const avail = UPGRADES.filter((u) => (this.stacks[u.id] || 0) < u.max);
    const pool = [...avail];
    while (out.length < 3 && pool.length > 0) {
      const u: UpgradeDef = pool.splice(RI(0, pool.length - 1), 1)[0];
      out.push({
        id: u.id, name: u.name, icon: u.icon, max: u.max, rarity: u.rarity,
        stacks: this.stacks[u.id] || 0,
        desc: u.desc((this.stacks[u.id] || 0) + 1),
      });
    }
    return out;
  }

  applyUpgrade(id: string) {
    if (!this.modalOpen) return;
    this.stacks[id] = (this.stacks[id] || 0) + 1;
    this.recompute();
    if (id === "hp") this.pl.hp = Math.min(this.st.maxHp, this.pl.hp + 30);
    if (id === "bombardment") this.executeBombardment();
    this.sfx.upgrade();
    this.lvlPending--;
    if (this.lvlPending > 0) {
      this.onEvent({ type: "levelup", choices: this.rollChoices() });
    } else {
      // stay frozen if the stage-clear screen is still up
      this.modals.delete("levelup");
      if (this.stageIntermission) this.modals.add("stageclear");
      else this.modals.delete("stageclear");
      this.onEvent({ type: "resume" });
    }
  }

  /** Equip a specific owned weapon (also becomes that class's active variant). */
  equip(wid: string, silent = false) {
    if (!this.owned.has(wid) || this.kind === wid) return;
    this.kind = wid;
    this.equipped[WDEF[wid].cls] = wid;
    // swapping cancels an in-progress reload (per-weapon mags are preserved)
    this.reloading = false;
    this.reloadT = 0;
    if (this.ammo[wid] === undefined) this.ammo[wid] = this.effWeapon(wid).mag;
    this.recompute();
    // heavier weapons take longer to bring up
    this.pl.cd = Math.max(this.pl.cd, this.effWeapon(wid).swap);
    if (!silent) this.sfx.click();
    for (let i = 0; i < 8; i++)
      this.particles.push({
        x: this.pl.x + R(-10, 10), y: this.pl.y - 40 + R(-10, 10),
        vx: R(-60, 60), vy: R(-70, -10), life: 0.35, max: 0.35,
        size: R(1.5, 3), color: "#fbbf24", grav: 120, add: true,
      });
  }

  /**
   * Press a class key: equip that class's active variant.
   * Pressing it again while already on that class cycles through owned variants.
   */
  selectClass(cls: WeaponClass) {
    const list = byClass(cls).filter((w) => this.owned.has(w));
    if (list.length === 0) return;
    // only allow switching to this class if currently using a different class
    if (WDEF[this.kind].cls !== cls) {
      this.equip(this.equipped[cls] ?? list[0]);
    }
  }

  /** Q cycles between weapon classes only, not within a class. */
  cycleWeapon(dir = 1) {
    const currentCls = WDEF[this.kind].cls;
    const cls = CLASS_ORDER[(CLASS_ORDER.indexOf(currentCls) + dir + CLASS_ORDER.length) % CLASS_ORDER.length];
    this.selectClass(cls);
  }

  private recompute() {
    const s = (id: string) => this.stacks[id] || 0;
    const w = WDEF[this.kind] ?? WDEF.pistol;
    // multishot adds pellets to shotgun, extra rounds to everything else
    const extra = s("multi");
    const projectiles = w.projectiles + extra * (w.cls === "shotgun" ? 2 : 1);
    const spread = w.projectiles > 1 ? w.spread : 0.07;
    this.st = {
      damage: w.damage * (1 + 0.3 * s("dmg")),
      fireRate: w.fireRate * (1 + 0.22 * s("rate")),
      bulletSpeed: w.speed * (1 + 0.3 * s("velo")),
      jitter: Math.max(0.002, w.jitter * (1 - 0.22 * s("velo"))),
      projectiles,
      projSpread: spread,
      projJitter: 1,
      pierce: w.pierce + s("pierce"),
      crit: 0.05 + w.critBonus + 0.12 * s("crit"),
      // weapon class governs mobility (shotgun/BR are heavy, SMG/pistol are light)
      speed: 275 * (1 + 0.16 * s("speed")) * w.moveMul,
      maxHp: 100 + 30 * s("hp"),
      magnet: 1 + 0.7 * s("magnet"),
      lifesteal: 0.03 * s("vamp"),
      regen: 0.9 * s("regen"),
      dashMax: 2.3 * Math.pow(0.68, s("dash")),
    };
  }

  /* ---------------- inventory: crates, backpack, consumables ---------------- */

  private spawnCrate(tier: CrateTier) {
    // the arena is a fixed side-view lane (constant GROUND height, x-only
    // movement); open stages are full 2D, so a crate needs to scatter near
    // the player's actual position on both axes or it can land somewhere
    // they're nowhere near and never visibly reach
    const arena = this.stageDef.fixedCamera;
    const x = clamp(this.pl.x + R(-160, 160), 30, this.worldW - 30);
    const y = arena ? GROUND : clamp(this.pl.y + R(-140, 140), 30, WORLD_H - 30);
    this.crates.push({ x, y, tier, opened: false });
  }

  private isNearCrate(cr: Crate): boolean {
    const p = this.pl;
    return this.stageDef.fixedCamera
      ? Math.abs(cr.x - p.x) < 40
      : Math.hypot(cr.x - p.x, cr.y - p.y) < 40;
  }

  private updateCrates(dt: number) {
    let near: Crate | null = null;
    for (const cr of this.crates) {
      if (cr.opened) continue;
      if (this.isNearCrate(cr)) { near = cr; break; }
    }
    if (near && this.keys.has("KeyE")) {
      this.crateOpenT += dt;
      if (this.crateOpenT >= 1.2) {
        this.openCrate(near);
        this.crateOpenT = 0;
      }
    } else {
      this.crateOpenT = Math.max(0, this.crateOpenT - dt * 2);
    }
  }

  /** Rolls a loot tier straight into the backpack and returns a human summary
   * ("Field Bandage x2, Frag Grenade" / "nothing usable inside") — shared by
   * an in-world crate open and any loot granted with no physical crate
   * (stage-clear supplies, which would otherwise spawn a crate in a world
   * about to be torn down for the next stage, unreachable). */
  private grantLoot(tier: CrateTier): string {
    const drops = rollLoot(tier);
    const gainedCounts = new Map<string, number>();
    let lost = 0;
    for (const d of drops) {
      const placed = placeItem(BACKPACK_SIZE, this.backpack, shapeOfItem, {
        id: `it${this.nextItemSeq++}`, itemId: d.itemId,
      });
      if (placed) {
        this.backpack = placed;
        gainedCounts.set(d.itemId, (gainedCounts.get(d.itemId) ?? 0) + 1);
      } else lost++;
    }
    this.invVer++;
    // name the actual items collected instead of a bare count — capped at 2
    // named entries since the banner draws this as one non-wrapping line
    // (see drawBanner)
    const gainedEntries = [...gainedCounts.entries()]
      .map(([itemId, n]) => `${ITEMS[itemId]?.name ?? itemId}${n > 1 ? ` x${n}` : ""}`);
    const gainedList = gainedEntries.length > 2
      ? `${gainedEntries.slice(0, 2).join(", ")} +${gainedEntries.length - 2} more`
      : gainedEntries.join(", ");
    return gainedList
      ? lost > 0 ? `${gainedList} — backpack full, ${lost} left behind` : gainedList
      : "nothing usable inside";
  }

  private openCrate(cr: Crate) {
    cr.opened = true;
    const summary = this.grantLoot(cr.tier);
    this.sfx.levelup();
    this.shake(2);
    this.announce("CRATE OPENED", summary, 2.2);
    const arena = this.stageDef.fixedCamera;
    for (let i = 0; i < 14; i++)
      this.particles.push({
        x: cr.x, y: (arena ? GROUND : cr.y) - 10, vx: R(-90, 90), vy: R(-220, -60),
        life: R(0.3, 0.6), max: 0.6, size: R(2, 4), color: "#fbbf24", grav: 700, add: true,
      });
  }

  useConsumable(key: ConsumableKey) {
    if (this.mode !== "play" || this.over || this.paused || this.modalOpen) return;
    if (this.pl.useT > 0) return;
    const def = itemForHotkey(key);
    if (!def) return;
    const inst = this.backpack.find((it) => it.itemId === def.id);
    if (!inst) {
      this.texts.push({
        x: this.pl.x, y: this.pl.y - 88, vy: -44, life: 0.7, max: 0.7,
        text: `NO ${def.short}`, color: "#f87171", size: 11,
      });
      return;
    }
    this.backpack = removeItem(this.backpack, inst.id);
    this.invVer++;
    this.pl.useT = 0.5;
    switch (def.id) {
      case "bandage":
        this.pl.hp = Math.min(this.st.maxHp, this.pl.hp + this.st.maxHp * 0.4);
        break;
      case "grenade":
        this.throwGrenade();
        break;
      case "stim":
        this.stimT = 6;
        break;
    }
    this.sfx.upgrade();
    this.texts.push({
      x: this.pl.x, y: this.pl.y - 88, vy: -44, life: 0.8, max: 0.8,
      text: def.short, color: "#67e8f9", size: 12,
    });
  }

  private throwGrenade() {
    const p = this.pl;
    // Top-down: throw in aim direction at fixed range
    const angle = p.aim;
    const speed = 260;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.grenades.push({ x: p.x, y: p.y, vx, vy, fuse: 1.6 });
    this.sfx.shoot();
  }

  private updateGrenades(dt: number) {
    for (const g of this.grenades) {
      g.fuse -= dt;
      // Top-down: no gravity, grenades move in straight line
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      // Grenades despawn if they go out of bounds
      if (g.x < 0 || g.x > this.worldW || g.y < 0 || g.y > WORLD_H) {
        g.fuse = -1;
        // detonate shortly after it actually lands, not wherever it happens
        // to be when the original flight fuse runs out — a grenade that's
        // still sailing through the air 460px from the thrower can't hit
        // anything its own blast radius could ever reach
        g.fuse = Math.min(g.fuse, 0.3);
      }
      if (chance(0.5))
        this.particles.push({ x: g.x, y: g.y, vx: R(-10, 10), vy: R(-10, 10), life: 0.2, max: 0.2, size: 1.6, color: "#9ca3af", grav: 0, add: false });
      if (g.fuse <= 0) this.explodeGrenade(g);
    }
    this.grenades = this.grenades.filter((g) => g.fuse > 0);
  }

  private explodeGrenade(g: GrenadeProj) {
    const blast = 130;
    for (const z of this.zombies) {
      if (z.dead) continue;
      // a grenade is loud regardless of range — wakes sleepers well past its blast radius
      if (z.dormant && Math.hypot(z.x - g.x, z.y - g.y) < blast * 2.5) this.wakeZombie(z, true);
      const d = Math.hypot(z.x - g.x, z.y - 34 * z.scale - g.y);
      if (d < blast) {
        const dmg = 140 * (1 - d / blast);
        z.hp -= dmg;
        z.flash = 0.09;
        const dir = Math.sign(z.x - g.x) || 1;
        z.vx += dir * 260;
        this.texts.push({ x: z.x, y: z.y - 74 * z.scale, vy: -60, life: 0.55, max: 0.55, text: String(Math.round(dmg)), color: "#fbbf24", size: 14 });
        if (z.hp <= 0) this.killZombie(z, dir);
      }
    }
    this.shake(8);
    this.sfx.hurt();
    for (let i = 0; i < 24; i++)
      this.particles.push({
        x: g.x, y: g.y, vx: R(-260, 260), vy: R(-260, 20), life: R(0.3, 0.7), max: 0.7,
        size: R(2, 6), color: chance(0.5) ? "#f97316" : "#fde68a", grav: 900, add: true,
      });
  }

  /** Repositions a backpack item; returns whether the target cell was legal. */
  moveBackpackItem(id: string, x: number, y: number): boolean {
    const moved = moveItem(BACKPACK_SIZE, this.backpack, shapeOfItem, id, x, y);
    if (!moved) return false;
    this.backpack = moved;
    this.invVer++;
    return true;
  }

  /** Moves the whole backpack into the persistent safe-house stash. */
  depositAll() {
    if (this.backpack.length === 0) return;
    this.deposit = [...this.deposit, ...this.backpack.map((it) => it.itemId)];
    this.backpack = [];
    this.invVer++;
    this.sfx.click();
  }

  getInventory(): InventorySnapshot {
    return {
      invVer: this.invVer,
      backpack: this.backpack.map((it) => ({ id: it.id, itemId: it.itemId, x: it.x, y: it.y })),
      deposit: this.deposit,
      backpackSize: BACKPACK_SIZE,
    };
  }

  /* ---------------- waves ---------------- */

  /** Shared enemy weight table for the wave spawner. */
  // Continuous ramps instead of hard power gates — the old thresholds (power
  // >=2/3/4) meant a player saw nothing but walkers for most of stage 1 and
  // into stage 2, since power only reaches ~1.7 by the end of a 10-wave
  // stage 1. Every type now has some presence from wave 1, growing with power.
  private zombieWeights(power: number): Partial<Record<string, number>> {
    return {
      walker: 1,
      runner: Math.min(0.6, 0.16 + power * 0.05),
      spitter: Math.max(0, Math.min(0.4, (power - 0.5) * 0.08)),
      brute: Math.max(0, Math.min(0.35, (power - 0.8) * 0.06)),
      screamer: SCREAMER_WEIGHT,
    };
  }

  private buildWave(power: number, inStage: number): SpawnItem[] {
    const items: SpawnItem[] = [];
    const boss = this.stageDef.bossWaves.includes(inStage);
    // inStage adds its own escalation on top of power, so each wave within a
    // stage visibly spawns more than the last, not just a slow difficulty drift
    const count = boss
      ? Math.min(40, Math.round(6 + power * 1.5 + inStage * 1.2))
      : Math.min(72, Math.round(6 + power * 3.0 + power * power * 0.12 + inStage * 1.6));
    const weights = this.zombieWeights(power);
    for (let i = 0; i < count; i++) items.push({ type: rollEnemy(weights) as ZType });
    // shuffle the fodder
    for (let i = items.length - 1; i > 0; i--) {
      const j = RI(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    if (boss) {
      const finalWave = inStage === this.stageDef.wavesPerStage;
      if (finalWave) {
        // final wave of the stage = a swarm finale, stacking brute-bosses among the fodder
        const bosses = 1 + Math.min(2, Math.floor(this.stage / 2));
        for (let i = 0; i < bosses; i++) items.unshift({ type: "brute", boss: true });
      }
      // the mid-stage boss wave instead gets the Juggernaut Alpha — spawned
      // separately by startWave(), never through the fodder queue
    }
    return items;
  }

  /** The arena's fixed camera frame — a constant origin, not a mode flag. */
  private camOrigin() {
    return (this.worldW - W) / 2;
  }

  /** Starts the rest between waves — a plain break, or the arena's timed prep phase. */
  private beginRest(breakDur: number) {
    if (this.stageDef.fixedCamera) {
      this.phase = "prep";
      this.prepT = 45;
      this.repairWindowT = 12;
    } else {
      this.phase = "break";
      this.breakT = breakDur;
    }
  }

  /** Arena resupply: tops reserve up by a fraction of each weapon's capacity, capped at `cap` of it. */
  private awardSupply(amount: number, cap: number) {
    for (const id of WEAPON_IDS) {
      const maxReserve = this.effWeapon(id).reserve;
      if (maxReserve <= 0) continue; // unlimited/no reserve — nothing to top up
      this.reserve[id] = Math.max(this.reserve[id], Math.min(maxReserve * cap, this.reserve[id] + maxReserve * amount));
    }
  }

  /** Selects (or, passed the current selection, deselects) a deployable tool during prep. */
  selectDeployable(kind: DeployableKind | null) {
    if (this.phase !== "prep") return;
    this.placingKind = this.placingKind === kind ? null : kind;
  }

  /** World-x under the cursor -> the deployable slot it lands in. */
  private ghostSlot() {
    const centerX = this.worldW / 2;
    return worldXToSlot(this.cam + this.mouse.x, centerX);
  }

  /** Places the currently-selected tool at the cursor's slot, if it's free and affordable. */
  private tryPlaceDeployable() {
    if (!this.placingKind) return;
    const centerX = this.worldW / 2;
    const { lane, slot } = this.ghostSlot();
    const x = slotToWorldX(lane, slot, centerX);
    if (!canPlaceAt(this.deployables, lane, slot)) {
      this.sfx.dryFire();
      this.texts.push({ x, y: GROUND - 90, vy: -46, life: 0.8, max: 0.8, text: "SLOT TAKEN", color: "#f87171", size: 12 });
      return;
    }
    const def = DEPLOYABLE_DEFS[this.placingKind];
    if (this.scrap < def.buildCost) {
      this.sfx.dryFire();
      this.texts.push({ x, y: GROUND - 90, vy: -46, life: 0.8, max: 0.8, text: `NEED ${def.buildCost} SCRAP`, color: "#f87171", size: 12 });
      return;
    }
    this.scrap -= def.buildCost;
    this.deployables.push({
      id: `dep-${this.nextDeployableSeq++}`,
      kind: this.placingKind, lane, slot, hp: def.hp, maxHp: def.hp, armed: true,
    });
    this.sfx.click();
  }

  /** Spends scrap to fully restore a damaged deployable. */
  repairDeployable(id: string) {
    const d = this.deployables.find((x) => x.id === id);
    if (!d || d.hp >= d.maxHp) return;
    const cost = DEPLOYABLE_DEFS[d.kind].repairCost;
    if (this.scrap < cost) return;
    this.scrap -= cost;
    d.hp = d.maxHp;
    this.sfx.click();
  }

  getDeployables(): Deployable[] {
    return this.deployables.map((d) => ({ ...d }));
  }

  /** Claymore proximity trigger — holds through an active ambush instead of firing on the first zombie. */
  private updateDeployables() {
    if (!this.stageDef.fixedCamera || this.ambushT > 0) return;
    const centerX = this.worldW / 2;
    for (const d of this.deployables) {
      if (d.kind !== "claymore" || !d.armed) continue;
      const x = slotToWorldX(d.lane, d.slot, centerX);
      const hit = this.zombies.find((z) => !z.dead && Math.abs(z.x - x) < 26);
      if (hit) this.explodeClaymore(d, x);
    }
  }

  private explodeClaymore(d: Deployable, x: number) {
    d.armed = false;
    const blast = 90;
    const y = GROUND - 20;
    for (const z of this.zombies) {
      if (z.dead) continue;
      if (z.dormant && Math.hypot(z.x - x, z.y - y) < blast * 2.5) this.wakeZombie(z, true);
      const dist = Math.hypot(z.x - x, z.y - 34 * z.scale - y);
      if (dist < blast) {
        const dmg = 180 * (1 - dist / blast);
        z.hp -= dmg;
        z.flash = 0.09;
        const dir = Math.sign(z.x - x) || 1;
        z.vx += dir * 280;
        this.texts.push({ x: z.x, y: z.y - 74 * z.scale, vy: -60, life: 0.55, max: 0.55, text: String(Math.round(dmg)), color: "#fbbf24", size: 14 });
        if (z.hp <= 0) this.killZombie(z, dir);
      }
    }
    this.shake(9);
    this.sfx.hurt();
    for (let i = 0; i < 20; i++)
      this.particles.push({
        x, y, vx: R(-240, 240), vy: R(-240, 10), life: R(0.3, 0.6), max: 0.6,
        size: R(2, 5), color: chance(0.5) ? "#f97316" : "#fde68a", grav: 900, add: true,
      });
  }

  private startWave(inStage: number) {
    this.waveInStage = inStage;
    this.waveIndex = cumulativeWaveIndex(this.stage, inStage);
    this.power = difficultyFor(this.stage, inStage);
    const finalWave = inStage === this.stageDef.wavesPerStage;
    // stage 5 and 10 cap their final wave with a horde finale instead of a
    // normal fixed-size batch — a sustained, continuously-refilled swarm
    // with a boss-tier zombie, see HORDE_STAGES and the "active" phase update
    const hordeFinale = !this.stageDef.fixedCamera && finalWave && HORDE_STAGES.includes(this.stage);
    if (hordeFinale) {
      this.queue = [];
      this.waveTotal = 0;
      this.hordeT = HORDE_DURATION;
      this.hordeTotal = HORDE_DURATION;
    } else {
      this.queue = this.buildWave(this.power, inStage);
      this.waveTotal = this.queue.length;
      this.hordeT = 0;
      this.hordeTotal = 0;
    }
    this.phase = "active";
    this.spawnT = 0.6;
    this.boss = null;
    this.bossForceTarget = false;
    // exploration stages carry no bossId, so they never spawn a boss even if
    // their bossWaves array still marks a wave for the finale-swarm treatment
    const bossWave = this.stageDef.bossId != null && this.stageDef.bossWaves.includes(inStage);
    if (bossWave && !finalWave) this.spawnBoss();
    if (hordeFinale) {
      this.announce("THE HORDE IS HERE", `survive ${HORDE_DURATION}s — something big is coming`, 3);
      this.spawnZombie({ type: "brute", boss: true });
    } else if (bossWave) {
      const def = BOSS_DEFS[this.stageDef.bossId!] ?? BOSS_DEFS.juggernaut;
      this.announce(
        finalWave ? "FINAL WAVE" : def.tellName,
        finalWave ? "clear it to escape this place" : def.tellSub
      );
    } else {
      this.announce(`WAVE ${inStage} / ${this.stageDef.wavesPerStage}`, WAVE_SUBS[this.waveIndex % WAVE_SUBS.length]);
    }
    this.sfx.wave();
  }

  /** Spawns the stage's Terminal Defense boss, per its `bossId` (defaults to the Juggernaut). */
  private spawnBoss() {
    // stub acts (II, III, V, VI) name a bossId whose BOSS_DEFS entry doesn't
    // exist until that act's own phase lands — fall back to the Juggernaut
    // rather than crash, same as an unset bossId
    const def = BOSS_DEFS[this.stageDef.bossId ?? "juggernaut"] ?? BOSS_DEFS.juggernaut;
    const hpMul = 1 + (this.power - 1) * 0.22;
    const maxHp = Math.round(150 * hpMul * 4.4 * 1.3 * def.hpMul);
    const side: 1 | -1 = chance(0.5) ? -1 : 1;
    const x = clamp(side < 0 ? this.cam - 200 : this.cam + W + 200, 40, this.worldW - 40);
    this.boss = {
      defId: def.id,
      x, y: GROUND, r: def.r, scale: def.scale, dead: false,
      vx: 0, face: -side as 1 | -1, flash: 0, hurtT: 0,
      hp: maxHp, maxHp, phase: 0,
      state: "emerge", attack: null, timer: BOSS_EMERGE_DURATION, atk: 0,
      targetX: this.pl.x, targetY: this.pl.y,
      tint: Math.random(), wob: R(0, TAU), t: 0,
    };
    // a large grave splits open under the entrance point — drawn directly
    // (not pushed into `decor`) so it never gets a solid-collision radius
    // from DECOR_SOLID_R; a crater the player can't walk into would just
    // trap them against it in the arena's narrow lane
    this.bossGrave = { x, y: GROUND };
    for (let i = 0; i < 24; i++) {
      const ang = R(0, TAU);
      this.particles.push({
        x, y: GROUND, vx: Math.cos(ang) * R(40, 160), vy: Math.sin(ang) * R(40, 160) - 80,
        life: R(0.5, 1), max: 1, size: R(3, 6), color: "#1c1712", grav: 500, add: false,
      });
    }
    this.shake(9);
  }

  /** Called after the stage's last wave is cleared — freezes the sim for the stage-clear screen.
   * Used to require walking a gated corridor to a safe house first; that was a side-scroller-era
   * mechanic (fixed "GROUND" y, gates you "clear" by walking into) that doesn't fit open 2D
   * exploration, so clearing the last wave now finishes the stage directly. */
  private completeStage() {
    const cleared = this.stage;
    this.stageIntermission = true;
    this.modals.add("stageclear"); // freeze the sim behind the stage-clear screen
    this.phase = "break";
    const bonus = 500 * cleared;
    this.score += bonus;
    // full heal between stages — except leaving the arena, which stays scrap-and-supply-only
    if (!this.stageDef.fixedCamera) this.pl.hp = this.st.maxHp;
    // safe house resupply: reserve tops up to 50% (not full)
    for (const id of WEAPON_IDS) {
      if (this.reserve[id] >= 0) this.reserve[id] = Math.max(this.reserve[id], Math.round(this.effWeapon(id).reserve * 0.5));
    }
    // a clear stage deserves a real supply drop — a physical crate spawned
    // here would be left behind in a world about to be replaced, so grant it
    // straight into the backpack instead (the Safe House screen right after
    // is exactly where the player will see it)
    this.grantLoot(HORDE_STAGES.includes(cleared) ? 3 : 2);
    this.writeCheckpoint(cleared + 1);
    this.sfx.levelup();
    this.onEvent({
      type: "stageclear", stage: cleared, next: cleared + 1,
      stageName: this.stageDef.name, stageSub: this.stageDef.sub,
      wavesPerStage: this.stageDef.wavesPerStage,
    });
  }

  /** Player confirmed the stage-clear screen. */
  advanceStage() {
    if (!this.stageIntermission) return;
    this.setStage(this.stage + 1);
    // walk out of the safe house back onto the left side of the new stage —
    // also what keeps startTravel()'s safeHouseX comfortably in-bounds
    this.pl.x = clamp(this.worldW * 0.12, 40, this.worldW - 40);
    this.pl.y = WORLD_H / 2;
    this.pl.vx = 0;
    this.pl.vy = 0;
    this.cam = this.stageDef.fixedCamera ? this.camOrigin() : clamp(this.pl.x - W / 2, 0, this.worldW - W);
    this.camY = clamp(this.pl.y - H / 2, 0, WORLD_H - H);
    this.waveInStage = 0;
    this.stageIntermission = false;
    this.modals.delete("stageclear");
    this.bullets = [];
    this.eshots = [];
    // full reload on every weapon when moving on — no carrying a half-empty mag into the next stage
    for (const id of WEAPON_IDS) this.ammo[id] = this.effWeapon(id).mag;
    this.reloading = false;
    this.reloadT = 0;
    this.beginRest(2.6);
    this.announce(`STAGE ${this.stage} — ${this.stageDef.name}`, this.stageDef.sub, 2.8);
  }

  private mkZombie(type: ZType, x: number, y: number, hpMul: number, speedMul: number): Zombie {
    const c = ZCONF[type];
    const scale = c.scale * R(0.94, 1.07);
    const hp = c.hp * hpMul;
    return {
      x, y, vx: 0, vy: 0,
      hp, maxHp: hp,
      speed: c.speed * speedMul * R(0.9, 1.1),
      dmg: c.dmg, r: c.r * scale, scale,
      type, xp: c.xp, score: c.score,
      t: R(0, 10), atk: R(0, 0.4), flash: 0, face: 1, dead: false, spit: R(1, 2.4),
      tint: Math.random(), boss: false, wob: R(0, TAU), dormant: false, blockedBy: null, slowT: 0,
      alertT: 0, burnT: 0, burnDps: 0,
    };
  }

  private spawnZombie(it: SpawnItem) {
    const power = this.power;
    const hpMul = (1 + (power - 1) * 0.22) * (it.boss ? 4.4 : 1);
    const speedMul = 1 + Math.min(0.55, (power - 1) * 0.035);
    const dmgMul = 1 + (power - 1) * 0.07;

    // Top-down: spawn from all directions around player edge
    const angle = Math.random() * TAU;
    const dist = 450 + R(0, 200);
    let x = this.pl.x + Math.cos(angle) * dist;
    let y = this.pl.y + Math.sin(angle) * dist;

    // Keep within world bounds
    x = clamp(x, 22, this.worldW - 22);
    y = clamp(y, 22, WORLD_H - 22);

    const z = this.mkZombie(it.type, x, y, hpMul, speedMul);
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

    // Omnidirectional spawn particles
    for (let i = 0; i < 8; i++)
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * R(30, 70),
        vy: Math.sin(angle) * R(30, 70),
        life: R(0.3, 0.6), max: 0.6, size: R(2, 5), color: "#241d18", grav: 0, add: false
      });
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
    const nearCrate = this.crates.find((c) => !c.opened && this.isNearCrate(c)) ?? null;
    return {
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: this.st.maxHp,
      xp: Math.round(p.xp),
      xpNext: p.xpNext,
      level: p.level,
      stage: this.stage,
      stageName: this.stageDef.name,
      waveInStage: this.waveInStage,
      wavesPerStage: this.stageDef.wavesPerStage,
      bossWaves: this.stageDef.bossWaves,
      isBossWave: this.stageDef.bossWaves.includes(this.waveInStage),
      waveTotal: this.waveTotal,
      remaining: this.queue.length + this.zombies.length,
      hordeT: Math.max(0, this.hordeT),
      hordeTotal: this.hordeTotal,
      phase: this.phase,
      score: this.score,
      kills: this.kills,
      high: this.high,
      dashT: Math.max(0, p.dashCd),
      dashMax: this.st.dashMax,
      weapon: WDEF[this.kind].name,
      weaponRole: CLASS_ROLE[WDEF[this.kind].cls],
      weapons: CLASS_ORDER.map((cls, i) => {
        const ownedInClass = byClass(cls).filter((w) => this.owned.has(w));
        const active = this.equipped[cls] ?? ownedInClass[0];
        const shown = active ?? byClass(cls)[0];
        return {
          cls,
          label: CLASS_LABEL[cls],
          short: ownedInClass.length > 0 ? WDEF[shown].short : CLASS_LABEL[cls],
          owned: ownedInClass.length > 0,
          active: WDEF[this.kind].cls === cls,
          key: String(i + 1),
          ammo: this.ammo[shown] ?? 0,
          mag: this.effWeapon(shown).mag,
          variants: ownedInClass.length,
        };
      }),
      ammo: this.ammo[this.kind] ?? 0,
      mag: this.effWeapon(this.kind).mag,
      reserve: this.reserve[this.kind] ?? 0,
      autoFire: this.autoFire,
      facing: this.facing,
      onTarget: this.onTarget,
      range: this.effWeapon(this.kind).range,
      reloading: this.reloading,
      reloadPct: this.reloadDur > 0 ? 1 - this.reloadT / this.reloadDur : 0,
      paused: this.paused,
      muted: this.sfx.muted,
      playing: this.mode === "play" && !this.over,
      crateNear: nearCrate !== null,
      crateTier: nearCrate?.tier ?? 0,
      crateOpenPct: clamp(this.crateOpenT / 1.2, 0, 1),
      arena: this.stageDef.fixedCamera,
      prepT: Math.max(0, this.prepT),
      prepMax: 45,
      placingKind: this.placingKind,
      scrap: this.scrap,
      repairWindowT: Math.max(0, this.repairWindowT),
      repairWindowMax: 12,
      bossActive: !!this.boss && !this.boss.dead,
      bossName: this.boss ? BOSS_DEFS[this.boss.defId].name : null,
      bossHp: this.boss?.hp ?? 0,
      bossHpMax: this.boss?.maxHp ?? 0,
      bossPhase: this.boss?.phase ?? 0,
      bossAttack: this.boss?.state === "windup" ? this.boss.attack : null,
      bossWindupPct: this.boss?.state === "windup" && this.boss.attack
        ? 1 - clamp(this.boss.timer / windupFor(this.boss.attack, this.boss.phase, BOSS_DEFS[this.boss.defId]), 0, 1)
        : 0,
      bossForceTarget: this.bossForceTarget,
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

  /** Draws gems/crates/zombies/player/bullets/grenades/enemy-shots/particles/
   * float-texts, cam-relative. */
  private drawEntities(cam: number, camY: number, t: number) {
    const c = this.ctx;
    c.save();
    c.translate(-cam, camY);
    for (const g of this.gems) this.drawGem(g, t);
    for (const cr of this.crates) if (!cr.opened) this.drawCrate(cr, t);
    c.restore();

    for (const z of this.zombies) this.drawZombie(z, cam, camY, t);
    if (this.boss && !this.boss.dead) this.drawBoss(this.boss, cam, camY, t);
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
    // thrown grenades
    for (const g of this.grenades) {
      const spin = t * 14;
      c.save();
      c.translate(g.x, g.y);
      c.rotate(spin);
      c.fillStyle = g.fuse < 0.35 ? (Math.sin(t * 40) > 0 ? "#f87171" : "#7f1d1d") : "#3f6212";
      c.beginPath();
      c.arc(0, 0, 4, 0, TAU);
      c.fill();
      c.restore();
    }
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
  }

  private render() {
    const c = this.ctx;
    const t = this.tGlobal;
    const cam = this.cam + this.shakeX;
    // draw code uses the "py = worldY + camY" convention (see drawPlayer/
    // drawZombie/drawBoss), so this needs to be the negated vertical scroll,
    // not just the shake jitter — this was the bug keeping the camera from
    // ever panning vertically, the main reason the game still read as a
    // side view despite the player being able to move in full 2D
    const camY = -this.camY + this.shakeY;

    c.clearRect(0, 0, W, H);

    // the player's actual screen position — usually screen-centered, but the
    // camera clamps at world edges (see cam/camY assignments), so anything
    // meant to track the player (light pool, vignette, flashlight cone) has
    // to use this, not a hardcoded W/2,H/2, or it visibly detaches near edges
    const px = this.pl.x - cam, py = this.pl.y + camY;

    /* --- top-down ground (per-stage theme, no sky/horizon) --- */
    const theme = this.theme;
    c.fillStyle = theme.groundDeep;
    c.fillRect(0, 0, W, H);

    // soft pool of light around the player, anchored to their real screen position
    const pool = c.createRadialGradient(px, py, 40, px, py, H * 0.62);
    pool.addColorStop(0, theme.groundTop);
    pool.addColorStop(1, theme.groundMid);
    c.fillStyle = pool;
    c.fillRect(0, 0, W, H);

    c.save();
    c.translate(-cam, camY);
    // visible world-space bounds, inverse of the translate above
    const wx0 = cam - 80, wx1 = cam + W + 80;
    const wy0 = -camY - 80, wy1 = H - camY + 80;

    // fine scan grid — sells top-down motion without a horizon line
    c.strokeStyle = "rgba(255,255,255,0.035)";
    c.lineWidth = 1;
    const grid = 64;
    c.beginPath();
    for (let gx = Math.floor(wx0 / grid) * grid; gx < wx1; gx += grid) {
      c.moveTo(gx, wy0);
      c.lineTo(gx, wy1);
    }
    for (let gy = Math.floor(wy0 / grid) * grid; gy < wy1; gy += grid) {
      c.moveTo(wx0, gy);
      c.lineTo(wx1, gy);
    }
    c.stroke();

    // ground tufts (world-space, no parallax — the ground is directly beneath you)
    c.strokeStyle = "rgba(52,84,56,0.7)";
    c.lineWidth = 1.4;
    for (const tu of this.tufts) {
      if (tu.x < wx0 || tu.x > wx1 || tu.y < wy0 || tu.y > wy1) continue;
      const sway = Math.sin(t * 1.4 + tu.x) * 1.4;
      c.beginPath();
      c.moveTo(tu.x, tu.y + 1);
      c.quadraticCurveTo(tu.x + sway, tu.y - tu.h * 0.6, tu.x - 3 * tu.s + sway, tu.y - tu.h);
      c.moveTo(tu.x + 4, tu.y + 1);
      c.quadraticCurveTo(tu.x + 4 + sway, tu.y - tu.h * 0.5, tu.x + 7 * tu.s + sway, tu.y - tu.h * 0.8);
      c.stroke();
    }

    // blood decals, flat pools at their actual world position
    for (const d of this.decals) {
      if (d.x < wx0 || d.x > wx1 || d.y < wy0 || d.y > wy1) continue;
      c.fillStyle = `rgba(80,14,18,${d.a})`;
      c.beginPath();
      c.ellipse(d.x, d.y, 14 * d.s, 10 * d.s, 0, 0, TAU);
      c.fill();
      c.fillStyle = `rgba(60,10,12,${d.a * 0.8})`;
      c.beginPath();
      c.ellipse(d.x + 9 * d.s, d.y + 6 * d.s, 6 * d.s, 4 * d.s, 0, 0, TAU);
      c.fill();
    }

    // the boss's grave — a lasting scar, drawn flat like the blood decals
    // above rather than through the decor/collision system (see spawnBoss())
    if (this.bossGrave) {
      const g = this.bossGrave;
      c.fillStyle = "rgba(10,8,6,0.75)";
      c.beginPath();
      c.ellipse(g.x, g.y, 46, 22, 0, 0, TAU);
      c.fill();
      c.strokeStyle = "rgba(60,50,40,0.5)";
      c.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU + g.x * 0.01;
        c.beginPath();
        c.moveTo(g.x + Math.cos(ang) * 20, g.y + Math.sin(ang) * 10);
        c.lineTo(g.x + Math.cos(ang) * 54, g.y + Math.sin(ang) * 26);
        c.stroke();
      }
    }

    // decor, scattered across the full 2D play area as top-down footprints
    for (const d of this.decor) {
      if (d.x < wx0 || d.x > wx1 || d.y < wy0 || d.y > wy1) continue;
      this.drawDecor(d, t);
    }
    c.restore();

    /* --- vignette (darkness beyond the player's light) --- */
    const vg = c.createRadialGradient(px, py, H * 0.3, px, py, H * 0.74);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    // flashlight-style vision cone, anchored to the player's real screen
    // position and aimed with them — the arena stays on the old omnidirectional
    // pool above since it's a fixed side-view lane, not a direction you turn to look
    if (!this.stageDef.fixedCamera) {
      const aim = this.pl.aim;
      const coneR = Math.hypot(W, H) * 1.5;
      const darkenOutside = (half: number, alpha: number) => {
        c.save();
        c.beginPath();
        c.rect(0, 0, W, H);
        c.moveTo(px, py);
        c.arc(px, py, coneR, aim - half, aim + half);
        c.closePath();
        c.clip("evenodd");
        c.fillStyle = `rgba(0,0,0,${alpha})`;
        c.fillRect(0, 0, W, H);
        c.restore();
      };
      darkenOutside(0.95, 0.18);
      darkenOutside(FLASHLIGHT_HALF_ANGLE, 0.22);
    }

    /* --- arena: deployables + placement ghost --- */
    if (this.stageDef.fixedCamera) {
      c.save();
      c.translate(-cam, camY);
      for (const d of this.deployables) this.drawDeployable(d, t);
      if (this.phase === "prep" && this.placingKind) this.drawPlacementGhost();
      c.restore();
    }

    /* --- gems / crates / zombies / player / projectiles --- */
    this.drawEntities(cam, camY, t);

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
        const hg = c.createRadialGradient(px, py, H * 0.32, px, py, H * 0.72);
        hg.addColorStop(0, "rgba(153,27,27,0)");
        hg.addColorStop(1, `rgba(127,20,20,${a})`);
        c.fillStyle = hg;
        c.fillRect(0, 0, W, H);
      }
      // dash ghost cooldown glow at player feet
      if (this.pl.dashCd <= 0 && this.paused === false && this.modalOpen === false) {
        c.save();
        c.translate(this.pl.x - cam, this.pl.y + 16 + camY);
        c.globalAlpha = 0.12 + 0.08 * Math.sin(t * 4);
        c.fillStyle = "#67e8f9";
        c.beginPath();
        c.ellipse(0, 0, 22, 4.5, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    }

    /* --- LASER SIGHT (effective range indicator) --- */
    if (this.mode === "play" && !this.over && !this.reloading) {
      const p = this.pl;
      const w = this.effWeapon(this.kind);
      const range = w.range * (1 + 0.12 * (this.stacks["velo"] || 0));
      const ox = p.x - cam + Math.cos(p.aim) * 20;
      const oy = p.y + camY + Math.sin(p.aim) * 20;
      const ex = ox + Math.cos(p.aim) * range;
      const ey = oy + Math.sin(p.aim) * range;
      const hot = this.onTarget;
      const flash = Math.max(0, this.laserFlash);
      c.save();
      c.globalCompositeOperation = "lighter";
      // outer glow beam
      c.strokeStyle = hot
        ? `rgba(255,60,60,${0.5 + 0.3 * Math.sin(t * 18) + flash})`
        : "rgba(255,40,40,0.16)";
      c.lineWidth = hot ? 3.2 : 1.6;
      c.beginPath();
      c.moveTo(ox, oy);
      c.lineTo(ex, ey);
      c.stroke();
      // bright core
      c.strokeStyle = hot ? "rgba(255,220,220,0.95)" : "rgba(255,120,120,0.3)";
      c.lineWidth = hot ? 1.3 : 0.7;
      c.beginPath();
      c.moveTo(ox, oy);
      c.lineTo(ex, ey);
      c.stroke();
      // range terminator tick
      c.strokeStyle = hot ? "rgba(255,90,90,0.9)" : "rgba(255,60,60,0.35)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ex - Math.sin(p.aim) * 7, ey + Math.cos(p.aim) * 7);
      c.lineTo(ex + Math.sin(p.aim) * 7, ey - Math.cos(p.aim) * 7);
      c.stroke();
      // dot on the locked target
      if (hot && this.target) {
        const isBoss = this.target === this.boss;
        const tx = this.target.x - cam;
        const ty = (isBoss ? this.target.y - 36 * this.target.scale : this.target.y) + camY;
        c.fillStyle = "rgba(255,70,70,0.9)";
        c.beginPath();
        c.arc(tx, ty, 3.5 + Math.sin(t * 20) * 1.2, 0, TAU);
        c.fill();
        c.strokeStyle = "rgba(255,120,120,0.7)";
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(tx, ty, 11 + Math.sin(t * 12) * 1.6, 0, TAU);
        c.stroke();
      }
      c.restore();
    }

    /* --- reload ring above player --- */
    if (this.mode === "play" && !this.over && this.reloading) {
      const rx = this.pl.x - cam;
      const ry = this.pl.y - 96 + camY;
      const pct = this.reloadDur > 0 ? 1 - this.reloadT / this.reloadDur : 0;
      c.save();
      c.lineCap = "round";
      c.strokeStyle = "rgba(0,0,0,0.5)";
      c.lineWidth = 4.5;
      c.beginPath();
      c.arc(rx, ry, 13, 0, TAU);
      c.stroke();
      c.strokeStyle = "#fbbf24";
      c.lineWidth = 3.4;
      c.beginPath();
      c.arc(rx, ry, 13, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
      c.stroke();
      c.textAlign = "center";
      c.font = '700 11px "Space Grotesk", sans-serif';
      c.fillStyle = "#fde68a";
      c.fillText("RELOAD", rx, ry + 25);
      c.restore();
    }

    /* --- low / empty ammo warning --- */
    if (this.mode === "play" && !this.over && !this.reloading) {
      const cur = this.ammo[this.kind] ?? 0;
      const mag = this.effWeapon(this.kind).mag;
      if (cur === 0) {
        c.save();
        c.textAlign = "center";
        c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 9);
        c.font = '700 15px "Space Grotesk", sans-serif';
        c.fillStyle = "#f87171";
        (c as unknown as { letterSpacing: string }).letterSpacing = "3px";
        c.fillText("PRESS R TO RELOAD", this.pl.x - cam, this.pl.y - 96 + camY);
        (c as unknown as { letterSpacing: string }).letterSpacing = "0px";
        c.restore();
      } else if (cur / mag <= 0.25) {
        c.save();
        c.textAlign = "center";
        c.globalAlpha = 0.45 + 0.3 * Math.sin(t * 6);
        c.font = '700 13px "Space Grotesk", sans-serif';
        c.fillStyle = "#fbbf24";
        c.fillText("LOW AMMO", this.pl.x - cam, this.pl.y - 96 + camY);
        c.restore();
      }
    }

    /* --- banner --- */
    if (this.banners.length > 0) this.drawBanner(this.banners[0]);

    /* --- next wave countdown --- */
    if (this.mode === "play" && !this.over && this.phase === "break" && !this.stageIntermission && this.waveIndex > 0) {
      c.textAlign = "center";
      c.font = '600 15px "Space Grotesk", sans-serif';
      c.fillStyle = "rgba(226,232,240,0.55)";
      (c as unknown as { letterSpacing: string }).letterSpacing = "4px";
      c.fillText(`NEXT WAVE IN ${Math.max(1, Math.ceil(this.breakT))}`, W / 2, H - 48);
      (c as unknown as { letterSpacing: string }).letterSpacing = "0px";
    }

    /* --- reticle (manual mode only) --- */
    if (this.mode === "play" && !this.over && !this.modalOpen && !this.paused && !this.autoFire) {
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

    /* --- debug overlay (?debug=1) --- */
    if (this.debug) {
      c.save();
      c.textAlign = "left";
      c.font = '600 11px monospace';
      c.fillStyle = "#4ade80";
      c.fillText(
        `stage:${this.stage} phase:${this.phase} wave:${this.waveInStage}/${this.stageDef.wavesPerStage} power:${this.power.toFixed(1)} idx:${this.waveIndex} metaLv:${this.profile.metaLevel}`,
        8, H - 8
      );
      c.restore();
    }
  }

  private drawBanner(b: Banner) {
    const c = this.ctx;
    const p = 1 - b.t / b.dur;
    const a = p < 0.12 ? p / 0.12 : p > 0.72 ? (1 - p) / 0.28 : 1;
    const s = 1 + (1 - Math.min(1, p * 7)) * 0.35;
    c.save();
    // 280 (not the DOM top-HUD's own ~40% mark) leaves clearance below the
    // React-rendered stage/wave tracker, which is sized in real CSS px and so
    // doesn't shrink the way this canvas text does when the game's 16:9 box
    // is small (phone landscape) — too high here and the two overlap.
    c.translate(W / 2, 280);
    c.scale(s, s);
    c.globalAlpha = clamp(a, 0, 1);
    c.textAlign = "center";
    (c as unknown as { letterSpacing: string }).letterSpacing = "10px";
    c.font = "400 50px Anton, sans-serif";
    c.shadowColor = "rgba(245,158,11,0.5)";
    c.shadowBlur = 30;
    c.fillStyle = "#f4efe6";
    c.fillText(b.text, 0, 0);
    c.shadowBlur = 0;
    c.font = '600 17px "Space Grotesk", sans-serif';
    (c as unknown as { letterSpacing: string }).letterSpacing = "5px";
    c.fillStyle = "#f59e0b";
    c.fillText(b.sub.toUpperCase(), 0, 36);
    (c as unknown as { letterSpacing: string }).letterSpacing = "0px";
    c.restore();
  }

  /** Top-down footprint for each decor kind — drawn flat, as seen from directly above. */
  private drawDecor(d: Decor, t: number) {
    const c = this.ctx;
    c.save();
    c.translate(d.x, d.y);
    c.scale(d.s, d.s);
    // contact shadow every kind shares, drawn first so accessories sit on top
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.ellipse(1.5, 2, 15, 12, 0, 0, TAU);
    c.fill();
    if (d.kind === 0 || d.kind === 1) {
      // tombstone slab, seen from above
      c.fillStyle = "#141b29";
      c.strokeStyle = "rgba(148,163,184,0.18)";
      c.lineWidth = 1;
      if (d.kind === 0) {
        this.rr(-9, -13, 18, 26, 6);
        c.fill();
        c.stroke();
        c.strokeStyle = "rgba(148,163,184,0.28)";
        c.beginPath();
        c.moveTo(-5, 0); c.lineTo(5, 0);
        c.moveTo(0, -5); c.lineTo(0, 5);
        c.stroke();
      } else {
        this.rr(-12, -12, 24, 24, 4);
        c.fill();
        c.stroke();
      }
    } else if (d.kind === 2) {
      // dead tree canopy, viewed from above — irregular blob + radiating cracks
      const sway = Math.sin(t * 0.7 + d.ph) * 1.5;
      c.fillStyle = "#0c1119";
      c.beginPath();
      c.moveTo(20 + sway, 0);
      for (let i = 1; i <= 8; i++) {
        const a = (i / 8) * TAU;
        const rr = 15 + Math.sin(a * 3 + d.ph) * 5;
        c.lineTo(Math.cos(a) * rr + sway * 0.3, Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = "#1c2634";
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(12, -10);
      c.moveTo(0, 0); c.lineTo(-14, -4);
      c.moveTo(0, 0); c.lineTo(4, 14);
      c.stroke();
    } else if (d.kind === 3) {
      // lamp post — a small pole cross-section with a pool of light beneath it
      const flick = 0.75 + 0.25 * Math.sin(t * 9 + d.ph) * Math.sin(t * 3.7 + d.ph);
      const lg = c.createRadialGradient(0, 0, 2, 0, 0, 60);
      lg.addColorStop(0, `rgba(251,146,60,${0.22 * flick})`);
      lg.addColorStop(1, "rgba(251,146,60,0)");
      c.fillStyle = lg;
      c.fillRect(-60, -60, 120, 120);
      c.fillStyle = "#0b0f18";
      c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
      c.fillStyle = `rgba(253,186,116,${0.85 * flick})`;
      c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill();
    } else if (d.kind === 4) {
      // burnt-out car, roof/hood/trunk seen from above
      c.fillStyle = "#12161c";
      this.rr(-15, -28, 30, 56, 6);
      c.fill();
      c.fillStyle = "#1c222b";
      this.rr(-11, -16, 22, 30, 4);
      c.fill();
      c.fillStyle = "rgba(0,0,0,0.6)";
      c.fillRect(-9, -13, 18, 10);
      c.fillRect(-9, 5, 18, 8);
      c.fillStyle = "#05070a";
      c.beginPath(); c.arc(-15, -18, 5, 0, TAU); c.fill();
      c.beginPath(); c.arc(15, -18, 5, 0, TAU); c.fill();
      c.beginPath(); c.arc(-15, 18, 5, 0, TAU); c.fill();
      c.beginPath(); c.arc(15, 18, 5, 0, TAU); c.fill();
      // drifting smoke, blooming outward from the wreck
      const wob = Math.sin(t * 0.8 + d.ph) * 4;
      c.fillStyle = "rgba(148,163,184,0.12)";
      c.beginPath();
      c.ellipse(wob, -4, 20, 20, 0, 0, TAU);
      c.fill();
    } else if (d.kind === 5) {
      // concrete jersey barrier, a long slab with hazard stripes
      c.fillStyle = "#1a1d22";
      this.rr(-8, -22, 16, 44, 3);
      c.fill();
      c.strokeStyle = "rgba(148,163,184,0.18)";
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = `rgba(251,191,36,${0.35 + 0.15 * Math.sin(t * 2 + d.ph)})`;
      c.fillRect(-6, -3, 12, 3);
      c.fillRect(-6, 6, 12, 3);
    } else {
      // collapsed rubble pile, exposed rebar lying flat
      c.fillStyle = "#15181c";
      c.beginPath();
      c.moveTo(-18, -10);
      c.lineTo(-4, -20);
      c.lineTo(10, -8);
      c.lineTo(18, 6);
      c.lineTo(2, 18);
      c.lineTo(-14, 10);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(148,163,184,0.12)";
      c.lineWidth = 1;
      c.stroke();
      c.strokeStyle = "#3f2a18";
      c.lineWidth = 2;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-8, -4); c.lineTo(10, -10);
      c.moveTo(-4, 8); c.lineTo(8, 4);
      c.stroke();
    }
    c.restore();
  }

  private drawDeployable(d: Deployable, t: number) {
    const c = this.ctx;
    const x = slotToWorldX(d.lane, d.slot, this.worldW / 2);
    const pct = clamp(d.hp / d.maxHp, 0, 1);
    if (d.kind === "barricade") {
      c.fillStyle = pct > 0.5 ? "#78716c" : pct > 0.2 ? "#92400e" : "#7f1d1d";
      c.fillRect(x - 16, GROUND - 62, 32, 62);
      c.strokeStyle = "rgba(0,0,0,0.4)";
      c.lineWidth = 2;
      c.strokeRect(x - 16, GROUND - 62, 32, 62);
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(x - 18, GROUND - 74, 36, 5);
      c.fillStyle = pct > 0.5 ? "#4ade80" : pct > 0.2 ? "#fbbf24" : "#f87171";
      c.fillRect(x - 18, GROUND - 74, 36 * pct, 5);
    } else if (d.kind === "wire") {
      c.strokeStyle = pct > 0.3 ? "#94a3b8" : "#7f1d1d";
      c.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(x + i * 8, GROUND - 2);
        c.lineTo(x + i * 8 + 6, GROUND - 14);
        c.lineTo(x + i * 8 - 4, GROUND - 22);
        c.stroke();
      }
    } else {
      c.fillStyle = d.armed ? "#4b5563" : "#1f2937";
      c.beginPath();
      c.ellipse(x, GROUND - 4, 10, 4, 0, 0, TAU);
      c.fill();
      if (d.armed) {
        c.fillStyle = `rgba(248,113,113,${0.5 + 0.4 * Math.sin(t * 6)})`;
        c.beginPath();
        c.arc(x, GROUND - 6, 2, 0, TAU);
        c.fill();
      }
    }
  }

  private drawPlacementGhost() {
    if (!this.placingKind) return;
    const { lane, slot } = this.ghostSlot();
    const valid = canPlaceAt(this.deployables, lane, slot);
    const x = slotToWorldX(lane, slot, this.worldW / 2);
    const c = this.ctx;
    c.globalAlpha = 0.4;
    c.fillStyle = valid ? "#4ade80" : "#f87171";
    c.fillRect(x - 16, GROUND - 62, 32, 62);
    c.globalAlpha = 1;
  }

  private static readonly GEM_PALETTE: Record<Gem["kind"], [string, string, string, string]> = {
    xp: ["rgba(167,139,250,0.5)", "rgba(167,139,250,0)", "#c4b5fd", "#ede9fe"],
    scrap: ["rgba(148,163,184,0.5)", "rgba(148,163,184,0)", "#cbd5e1", "#f1f5f9"],
  };

  private drawGem(g: Gem, t: number) {
    const c = this.ctx;
    const bob = Math.sin(t * 3 + g.t) * 2.5;
    const y = g.rest || g.vy === 0 ? g.y + bob : g.y;
    const s = 3.5 + Math.min(3, g.val);
    const [glowA, glowB, fill, core] = Engine.GEM_PALETTE[g.kind];
    // fade out over the last 2s before it despawns, so vanishing never looks
    // like a pop — same idea as any other timed-life effect in this file
    const fadeStart = GEM_LIFETIME - 2;
    c.save();
    if (g.age > fadeStart) c.globalAlpha = Math.max(0, 1 - (g.age - fadeStart) / 2);
    c.globalCompositeOperation = "lighter";
    const gr = c.createRadialGradient(g.x, y, 0, g.x, y, s * 4);
    gr.addColorStop(0, glowA);
    gr.addColorStop(1, glowB);
    c.fillStyle = gr;
    c.fillRect(g.x - s * 4, y - s * 4, s * 8, s * 8);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(g.x, y - s);
    c.lineTo(g.x + s * 0.8, y);
    c.lineTo(g.x, y + s);
    c.lineTo(g.x - s * 0.8, y);
    c.closePath();
    c.fill();
    c.fillStyle = core;
    c.beginPath();
    c.moveTo(g.x, y - s * 0.5);
    c.lineTo(g.x + s * 0.35, y);
    c.lineTo(g.x, y + s * 0.5);
    c.lineTo(g.x - s * 0.35, y);
    c.closePath();
    c.fill();
    c.restore();
  }

  private drawCrate(cr: Crate, t: number) {
    const c = this.ctx;
    const tierColor = cr.tier === 3 ? "#fbbf24" : cr.tier === 2 ? "#a78bfa" : "#94a3b8";
    const bob = Math.sin(t * 2 + cr.x) * 1.5;
    c.save();
    c.translate(cr.x, cr.y - 12 + bob);
    // shadow
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.beginPath();
    c.ellipse(0, 14, 16, 4, 0, 0, TAU);
    c.fill();
    // crate body
    c.fillStyle = "#3f2a18";
    this.rr(-15, -14, 30, 28, 3);
    c.fill();
    c.strokeStyle = tierColor;
    c.lineWidth = 2;
    this.rr(-15, -14, 30, 28, 3);
    c.stroke();
    // strap cross
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-15, 0); c.lineTo(15, 0);
    c.moveTo(0, -14); c.lineTo(0, 14);
    c.stroke();
    // tier pips
    for (let i = 0; i < cr.tier; i++) {
      c.fillStyle = tierColor;
      c.beginPath();
      c.arc(-6 + i * 6, -20, 2, 0, TAU);
      c.fill();
    }
    // glow
    c.globalCompositeOperation = "lighter";
    const glow = c.createRadialGradient(0, 0, 2, 0, 0, 30);
    glow.addColorStop(0, `${tierColor}33`);
    glow.addColorStop(1, `${tierColor}00`);
    c.fillStyle = glow;
    c.fillRect(-30, -30, 60, 60);
    c.globalCompositeOperation = "source-over";
    c.restore();
  }

  private limb(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, w1: number, w2: number, color: string) {
    const c = this.ctx;
    const a = Math.atan2(y2 - y1, x2 - x1);
    const b = Math.atan2(y3 - y2, x3 - x2);
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x1 + Math.cos(a + Math.PI / 2) * w1, y1 + Math.sin(a + Math.PI / 2) * w1);
    c.lineTo(x2 + Math.cos(b + Math.PI / 2) * w2, y2 + Math.sin(b + Math.PI / 2) * w2);
    c.lineTo(x3, y3);
    c.lineTo(x2 - Math.cos(b + Math.PI / 2) * w2, y2 - Math.sin(b + Math.PI / 2) * w2);
    c.lineTo(x1 - Math.cos(a + Math.PI / 2) * w1, y1 - Math.sin(a + Math.PI / 2) * w1);
    c.closePath();
    c.fill();
  }

  /** Zombie, seen from above: the whole body rotates to face its actual
   * heading (chase velocity, or the player when idle) instead of only
   * flipping left/right, so it reads correctly approaching from any angle. */
  private drawZombie(z: Zombie, cam: number, camY: number, t: number) {
    const c = this.ctx;
    const px = z.x - cam;
    if (px < -100 || px > W + 100) return;
    const py = z.y + camY;
    // soft shadow, directly beneath — top-down, so it tracks the zombie's
    // own position rather than a fixed horizon line
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath();
    c.ellipse(px, py + 6, 16 * z.scale, 8 * z.scale, 0, 0, TAU);
    c.fill();

    const skinIdx = Math.floor(z.tint * SKIN.length) % SKIN.length;
    const skin = SKIN[skinIdx];
    const skinDark = CLOTH[skinIdx];
    const cloth = CLOTH[Math.floor(z.tint * 7) % CLOTH.length];
    const clothDark = "#161b26";

    // per-type proportions
    const bulk = z.type === "brute" ? 1.35 : z.type === "runner" ? 0.88 : 1;
    const moving = Math.hypot(z.vx, z.vy) > 4;
    const heading = moving ? Math.atan2(z.vy, z.vx) : z.face >= 0 ? 0 : Math.PI;
    const walk = z.dormant ? 0 : z.t * (2.4 + z.speed * 0.03);
    const shamble = Math.sin(walk);
    const shamble2 = Math.cos(walk * 0.6 + z.wob);
    const attacking = z.atk > (z.type === "brute" ? 0.75 : 0.42);
    const reach = attacking ? 4 : 0;

    c.save();
    c.translate(px, py);
    c.scale(z.scale, z.scale);
    c.rotate(heading);
    // everything below is drawn as if facing +x ("forward")

    // ---- legs, scissoring behind the body along the heading ----
    const l1 = shamble * 6 * bulk, l2 = -shamble * 6 * bulk;
    c.fillStyle = skinDark;
    c.beginPath(); c.ellipse(-8 + Math.abs(l1) * 0.2, 5 + l1, 4.2 * bulk, 3, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-8 + Math.abs(l2) * 0.2, -5 + l2, 4.2 * bulk, 3, 0, 0, TAU); c.fill();

    // ---- torso, a ragged oval seen from above ----
    const torsoGrad = c.createRadialGradient(-2, -2, 1, 0, 0, 11 * bulk);
    torsoGrad.addColorStop(0, cloth);
    torsoGrad.addColorStop(1, clothDark);
    c.fillStyle = torsoGrad;
    c.beginPath();
    c.ellipse(0, 0, 11 * bulk, 9 * bulk, 0, 0, TAU);
    c.fill();
    // grime + torn rips
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.beginPath(); c.ellipse(-2, 1, 5 * bulk, 4, 0, 0, TAU); c.fill();
    c.fillStyle = "rgba(80,14,18,0.32)";
    c.beginPath(); c.ellipse(3, -3, 3 * bulk, 2.6, -0.3, 0, TAU); c.fill();

    // ---- arms, clawed, reaching forward when attacking ----
    c.lineCap = "round";
    c.strokeStyle = skinDark;
    c.lineWidth = 3.4 * bulk;
    c.globalAlpha = 0.75;
    c.beginPath();
    c.moveTo(-2, -6 * bulk);
    c.lineTo(6 + reach, -10 * bulk - shamble2 * 1.5);
    c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = skin;
    c.beginPath();
    c.moveTo(-2, 6 * bulk);
    c.lineTo(7 + reach, 10 * bulk + shamble2 * 1.5);
    c.stroke();
    // claws on the front arm
    c.strokeStyle = "rgba(230,230,225,0.6)";
    c.lineWidth = 1.1;
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(7 + reach, 10 * bulk + i * 1.5);
      c.lineTo(11 + reach + i, 12 * bulk + i * 1.8);
      c.stroke();
    }

    // ---- head, forward, with a hanging jaw ----
    const headX = 9.5 * bulk;
    c.fillStyle = skin;
    c.beginPath();
    c.ellipse(headX, 0, 7.4, 7, 0, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(0,0,0,0.18)";
    c.beginPath(); c.ellipse(headX - 2, 1.6, 5, 4.6, 0, 0, TAU); c.fill();
    // hanging jaw
    c.save();
    c.translate(headX + 3.5, 3);
    c.rotate(0.4 + shamble2 * 0.1);
    c.fillStyle = skin;
    this.rr(0, 0, 5.4, 5, 2.2);
    c.fill();
    c.fillStyle = "rgba(0,0,0,0.45)";
    for (let i = 0; i < 2; i++) c.fillRect(1 + i * 2.1, 0.8, 1.3, 2.8);
    c.restore();
    // eyes — glowing, unless asleep (closed, no glow to give it away). The
    // Screamer's eyes stay a normal yellow until she's actually alerted, then
    // escalate to crimson as her scream windup counts down — the only tell
    // she gives before it fires
    if (!z.dormant) {
      const eye = z.boss || z.type === "brute" || (z.type === "screamer" && z.alertT > 0)
        ? "#ef4444" : "#fde047";
      c.globalAlpha = 0.3;
      c.fillStyle = eye;
      c.beginPath(); c.arc(headX + 2, -2.8, 3, 0, TAU); c.fill();
      c.beginPath(); c.arc(headX + 2, 2.8, 2.6, 0, TAU); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = eye;
      c.beginPath(); c.arc(headX + 2.4, -2.8, 1.4, 0, TAU); c.fill();
      c.beginPath(); c.arc(headX + 2.4, 2.8, 1.2, 0, TAU); c.fill();
    }

    // spitter sac, glowing at the chest
    if (z.type === "spitter") {
      const pulse = 1 + Math.sin(t * 5 + z.wob) * 0.12;
      c.globalCompositeOperation = "lighter";
      const gr = c.createRadialGradient(-1, 0, 1, -1, 0, 8 * pulse);
      gr.addColorStop(0, "rgba(190,242,100,0.6)");
      gr.addColorStop(1, "rgba(132,204,22,0)");
      c.fillStyle = gr;
      c.fillRect(-10, -10, 20, 20);
      c.globalCompositeOperation = "source-over";
    }

    // boss crown of gore (finale-swarm tier, distinct from the unique Boss)
    if (z.boss) {
      c.fillStyle = "rgba(127,29,29,0.5)";
      c.beginPath(); c.ellipse(headX - 4, 0, 4, 8, 0, 0, TAU); c.fill();
    }

    // hit flash
    if (z.flash > 0) {
      c.globalAlpha = clamp(z.flash * 9, 0, 0.8);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.ellipse(0, 0, 12 * bulk, 10 * bulk, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.ellipse(headX, 0, 7.6, 7.2, 0, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore(); // root

    // hp bar
    if (z.hp < z.maxHp) {
      const wBar = 30 * z.scale;
      const xBar = px - wBar / 2;
      const yBar = py - 24 * z.scale;
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(xBar, yBar, wBar, 3.4);
      c.fillStyle = z.boss ? "#f87171" : "#dc2626";
      c.fillRect(xBar, yBar, wBar * clamp(z.hp / z.maxHp, 0, 1), 3.4);
    }

    // sleeper tell — drifting zzz, the only hint it's dormant from a distance
    if (z.dormant) {
      c.save();
      c.textAlign = "center";
      c.font = '700 10px "Space Grotesk", sans-serif';
      c.fillStyle = "rgba(148,163,184,0.55)";
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i * 0.9) % 2.7;
        c.globalAlpha = clamp(1 - ph / 2.7, 0, 1) * 0.7;
        c.fillText("z", px + 6 * z.scale + i * 3, py - 20 * z.scale - ph * 10);
      }
      c.restore();
    }

    // Screamer windup tell — a tightening, faster-pulsing ring as the scream nears
    if (z.type === "screamer" && z.alertT > 0) {
      const pct = 1 - clamp(z.alertT / 1.4, 0, 1);
      c.save();
      c.globalAlpha = 0.3 + 0.4 * pct + 0.2 * Math.sin(t * (10 + pct * 20));
      c.strokeStyle = "#ef4444";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, (10 + pct * 4) * z.scale, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  private static readonly BOSS_TELL_COLOR: Record<BossAttack, string> = {
    slam: "#f97316", mortar: "#84cc16", call: "#c084fc", shieldcharge: "#38bdf8",
  };

  /** Ground telegraphs for the boss's windups — drawn under the boss so the tell reads clearly. */
  private drawBossTelegraphs(b: Boss, cam: number, camY: number) {
    if (b.state !== "windup" || !b.attack) return;
    const c = this.ctx;
    const def = BOSS_DEFS[b.defId];
    const pct = 1 - clamp(b.timer / windupFor(b.attack, b.phase, def), 0, 1);
    const color = Engine.BOSS_TELL_COLOR[b.attack];
    const isMortar = b.attack === "mortar";
    const cx = isMortar ? b.targetX - cam : b.x - cam;
    const cy = isMortar ? b.targetY + camY : b.y + camY;
    const meleeRadius = b.attack === "slam" ? 150 : b.attack === "shieldcharge" ? 110 : 0;
    const radius = (isMortar ? 95 : meleeRadius) * (0.35 + 0.65 * pct);
    if (radius > 0) {
      c.save();
      c.globalAlpha = 0.35 + 0.25 * Math.sin(pct * 18);
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.beginPath();
      // full circle, seen from above — not the squashed side-view ellipse
      c.arc(cx, cy, radius, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  private drawBoss(b: Boss, cam: number, camY: number, t: number) {
    const c = this.ctx;
    const px = b.x - cam;
    if (px < -140 || px > W + 140) return;
    const py = b.y + camY;
    // rising out of its grave: starts low/small/faded and grows into its
    // resting position as the emerge timer runs out — see spawnBoss()/updateBoss()
    const emergeT = b.state === "emerge" ? clamp(1 - b.timer / BOSS_EMERGE_DURATION, 0, 1) : 1;
    const riseOffset = (1 - emergeT) * 60;
    const visScale = 0.4 + 0.6 * emergeT;
    this.drawBossTelegraphs(b, cam, camY);
    const def = BOSS_DEFS[b.defId];
    // one base color per boss, shaded into torso/head/limb tones —
    // parameterizes the art instead of duplicating this ~90-line anatomy per boss
    const cTorso = def.color;
    const cArmFront = def.color;
    const cHead = shadeHex(def.color, 0.78);
    const cLegBack = shadeHex(def.color, 0.73);
    const cLegFront = shadeHex(def.color, 0.64);
    const cArmBack = shadeHex(def.color, 0.87);

    c.fillStyle = "rgba(0,0,0,0.5)";
    c.beginPath();
    c.ellipse(px, py + 8 + riseOffset, 30 * b.scale * visScale, 15 * b.scale * visScale, 0, 0, TAU);
    c.fill();

    const walk = b.state === "windup" ? 0 : b.t * 2.1;
    const shamble = Math.sin(walk);
    const windupPct = b.state === "windup" && b.attack ? 1 - clamp(b.timer / windupFor(b.attack, b.phase, def), 0, 1) : 0;
    const coreColor = b.attack ? Engine.BOSS_TELL_COLOR[b.attack] : "#ef4444";

    c.save();
    c.globalAlpha = 0.35 + 0.65 * emergeT;
    c.translate(px, py + riseOffset);
    c.scale(b.face * b.scale * visScale, b.scale * visScale);

    // legs
    const l1 = shamble * 6;
    this.limb(-6, -34, -7 + l1 * 0.5, -18, -8 + l1, -2, 8, 6, cLegBack);
    this.limb(6, -34, 7 - l1 * 0.5, -18, 8 - l1, -2, 8, 6, cLegFront);

    // torso — hulking slab
    c.fillStyle = cTorso;
    this.rr(-17, -70, 34, 42, 8);
    c.fill();
    c.fillStyle = "rgba(0,0,0,0.3)";
    this.rr(-17, -70, 34, 14, 8);
    c.fill();
    // cracked-plate texture
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 1.4;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(i * 9, -68); c.lineTo(i * 9 + 4, -30); c.stroke();
    }

    // arms
    const armSwing = Math.sin(walk * 0.8) * 4;
    this.limb(-14, -58, -24 + armSwing, -38, -28 + armSwing, -14, 8, 6.4, cArmBack);
    this.limb(14, -58, 24 - armSwing, -38, 28 - armSwing, -14, 8, 6.4, cArmFront);

    // riot shield accessory — the Neighborhood Watch only, over the forward arm
    if (def.shield) {
      c.save();
      c.fillStyle = "#334155";
      c.strokeStyle = "rgba(226,232,240,0.35)";
      c.lineWidth = 1.2;
      this.rr(22, -48, 12, 32, 3);
      c.fill();
      c.stroke();
      c.restore();
    }

    // head, small relative to the frame
    c.fillStyle = cHead;
    c.beginPath(); c.ellipse(0, -78, 10, 9.4, 0, 0, TAU); c.fill();
    c.fillStyle = coreColor;
    c.globalAlpha = 0.35 + 0.4 * windupPct;
    c.beginPath(); c.arc(3, -80, 3, 0, TAU); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = coreColor;
    c.beginPath(); c.arc(3.2, -80, 1.4, 0, TAU); c.fill();

    // chest core — glows brighter and faster the deeper into the windup
    const coreR = 7 + windupPct * 5 + Math.sin(t * (6 + windupPct * 14)) * 1.2;
    c.globalCompositeOperation = "lighter";
    const gr = c.createRadialGradient(0, -50, 1, 0, -50, coreR);
    gr.addColorStop(0, coreColor);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr;
    c.globalAlpha = 0.5 + 0.4 * windupPct;
    c.beginPath(); c.arc(0, -50, coreR, 0, TAU); c.fill();
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";

    if (b.flash > 0) {
      c.globalAlpha = clamp(b.flash * 9, 0, 0.8);
      c.fillStyle = "#ffffff";
      c.beginPath(); c.ellipse(0, -46, 20, 34, 0, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    c.restore();

    // boss hp bar — 3 segments, one per enrage phase
    const barW = 70 * b.scale, barX = px - barW / 2, barY = py - 128 * b.scale;
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(barX, barY, barW, 5);
    const pct = clamp(b.hp / b.maxHp, 0, 1);
    c.fillStyle = b.phase === 0 ? "#f87171" : b.phase === 1 ? "#fb923c" : "#facc15";
    c.fillRect(barX, barY, barW * pct, 5);
    c.strokeStyle = "rgba(0,0,0,0.7)";
    c.lineWidth = 1;
    for (const seg of [1 / 3, 2 / 3]) {
      c.beginPath(); c.moveTo(barX + barW * seg, barY); c.lineTo(barX + barW * seg, barY + 5); c.stroke();
    }
  }

  /** Player, drawn as seen from directly above: a round body, a head that
   * peeks toward the aim direction, feet that scissor along the heading
   * you're actually moving in, and a gun that rotates a full 360° with the
   * mouse instead of only flipping left/right. */
  private drawPlayer(cam: number, camY: number, t: number) {
    const c = this.ctx;
    const p = this.pl;
    const px = p.x - cam;
    const py = p.y + camY;

    // soft contact shadow, directly beneath — no side-view foot offset needed
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath();
    c.ellipse(px, py + 3, 14, 12, 0, 0, TAU);
    c.fill();

    c.save();
    c.translate(px, py);
    if (p.ifr > 0) c.globalAlpha = 0.55 + 0.45 * Math.sin(t * 42);
    if (p.dashT > 0) c.globalAlpha = 0.82;

    const vel = Math.hypot(p.vx, p.vy);
    const run = vel > 26;
    const heading = run ? Math.atan2(p.vy, p.vx) : p.aim;
    const bob = run ? Math.abs(Math.sin(p.walk)) * 1.4 : Math.sin(t * 2.1) * 0.5;
    const stride = run ? Math.sin(p.walk) * 6 : 0;

    // ---- feet, scissoring beneath the body along the movement heading ----
    c.save();
    c.rotate(heading);
    c.fillStyle = "#080c13";
    c.beginPath(); c.ellipse(-7 + Math.abs(stride) * 0.3, 6 + stride, 4.4, 3, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-7 + Math.abs(stride) * 0.3, -6 - stride, 4.4, 3, 0, 0, TAU); c.fill();
    c.restore();

    // ---- torso, a rounded tactical-vest body seen from above ----
    c.save();
    c.translate(0, bob);
    const torsoGrad = c.createRadialGradient(-3, -3, 2, 0, 0, 13);
    torsoGrad.addColorStop(0, "#0e7490");
    torsoGrad.addColorStop(1, "#0a3542");
    c.fillStyle = torsoGrad;
    c.beginPath();
    c.ellipse(0, 0, 12, 12, 0, 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.15)";
    c.lineWidth = 1;
    c.stroke();
    // backpack, trailing opposite the aim direction
    c.fillStyle = "#0b3a47";
    c.beginPath();
    c.ellipse(Math.cos(p.aim + Math.PI) * 8, Math.sin(p.aim + Math.PI) * 8, 7, 8, p.aim, 0, TAU);
    c.fill();
    // chest rig pouch
    c.fillStyle = "#0c4a5e";
    c.beginPath();
    c.ellipse(Math.cos(p.aim) * 5, Math.sin(p.aim) * 5, 4.5, 4.5, 0, 0, TAU);
    c.fill();

    // ---- head + beanie, peeking slightly toward the aim direction ----
    const headX = Math.cos(p.aim) * 5, headY = Math.sin(p.aim) * 5;
    c.fillStyle = "#7f1d1d";
    c.beginPath();
    c.ellipse(headX, headY, 7, 7, 0, 0, TAU);
    c.fill();
    c.fillStyle = "#5b1414";
    c.beginPath();
    c.arc(headX, headY, 7, p.aim - 0.5, p.aim + 0.5);
    c.arc(headX, headY, 4.5, p.aim + 0.5, p.aim - 0.5, true);
    c.fill();
    c.fillStyle = "#e8b892"; // face sliver facing the aim direction
    c.beginPath();
    c.ellipse(headX + Math.cos(p.aim) * 3.2, headY + Math.sin(p.aim) * 3.2, 3.6, 3.6, 0, 0, TAU);
    c.fill();
    c.fillStyle = "#1c1917"; // eyes, a hint of direction
    c.beginPath();
    c.ellipse(headX + Math.cos(p.aim) * 4.6, headY + Math.sin(p.aim) * 4.6, 1.3, 1.3, 0, 0, TAU);
    c.fill();
    c.restore(); // torso translate

    // ---- arm + weapon, rotating a full 360° with the aim angle ----
    const kick = clamp(p.flash * 12, 0, 1);
    const recoil = kick * 4;
    const wcls = WDEF[this.kind].cls;
    const gunLen =
      this.kind === "deagle" ? 32
      : wcls === "carbine" ? 38
      : wcls === "smg" ? 32
      : wcls === "shotgun" ? 36
      : 26;
    c.save();
    c.translate(0, bob);
    c.rotate(p.aim);
    // weapon body
    const bx = 7 + recoil;
    c.fillStyle = "#111a26";
    this.rr(bx, -4.5, gunLen - bx, 8, 2);
    c.fill();
    c.fillStyle = "#28323f";
    const tail = gunLen;
    if (wcls === "shotgun") {
      c.fillRect(tail - gunLen * 0.5, -3.2, gunLen * 0.5, 3.6);
      if (this.kind === "benelli") {
        c.fillStyle = "#3f2a18";
        c.fillRect(bx - 3.5, 1, 7, 5.5); // classic stock, tube fed
      } else {
        c.fillStyle = "#1c2634";
        c.beginPath();
        c.arc(bx + 6, 5, 4.6, 0, TAU); // big drum magazine
        c.fill();
      }
    } else if (wcls === "carbine") {
      c.fillRect(tail - gunLen * 0.5, -2.6, gunLen * 0.5, 3.2);
      c.fillStyle = "#1c2634";
      this.rr(bx - 3, -3.8, 6.5, 5, 2);
      c.fill(); // optic
      c.fillRect(bx + 6, 2.6, 3.4, 8); // straight mag
      if (this.kind === "asval") {
        c.fillStyle = "#0d141d";
        c.fillRect(tail - gunLen * 0.36, -3.4, gunLen * 0.34, 5); // suppressor shroud
      }
    } else if (wcls === "smg") {
      c.fillRect(tail - gunLen * 0.42, -2.8, gunLen * 0.42, 2.8);
      c.fillStyle = "#1c2634";
      if (this.kind === "bizon") {
        this.rr(bx + 3, 2.6, 14, 4.4, 2); // helical mag under barrel
        c.fill();
      } else if (this.kind === "p90") {
        this.rr(bx - 2, -7, 16, 3.4, 2); // top-mounted horizontal mag
        c.fill();
      } else {
        c.fillRect(bx + 5, 2.6, 3.4, 8.5); // vector box mag
      }
    } else {
      // pistols
      c.fillRect(tail - gunLen * 0.4, -2.9, gunLen * 0.4, 2.9);
      c.fillStyle = "#3f2a18";
      c.fillRect(bx - 2.5, 0.8, 5, 7); // grip
      if (this.kind === "deagle") {
        c.fillStyle = "#4b5563";
        c.fillRect(tail - gunLen * 0.4, -4, gunLen * 0.4, 1.6); // heavy slab slide rib
      } else if (this.kind === "tec9") {
        c.fillStyle = "#1c2634";
        c.fillRect(bx + 3.2, 1.8, 3, 9); // long stick mag
      }
    }
    // hand
    c.fillStyle = "#e8b892";
    c.beginPath();
    c.arc(bx - 1, 0, 2.4, 0, TAU);
    c.fill();
    // muzzle flash
    if (p.flash > 0) {
      const fa = clamp(p.flash * 16, 0, 1);
      const mx = gunLen + recoil;
      c.globalCompositeOperation = "lighter";
      const fg = c.createRadialGradient(mx, 0, 0, mx, 0, 24);
      fg.addColorStop(0, `rgba(254,240,138,${0.95 * fa})`);
      fg.addColorStop(0.4, `rgba(251,146,60,${0.55 * fa})`);
      fg.addColorStop(1, "rgba(251,146,60,0)");
      c.fillStyle = fg;
      c.fillRect(mx - 24, -24, 48, 48);
      c.strokeStyle = `rgba(254,240,138,${0.85 * fa})`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(mx, 0); c.lineTo(mx + 14 * fa, -6 * fa);
      c.moveTo(mx, 0); c.lineTo(mx + 16 * fa, 5 * fa);
      c.moveTo(mx, 0); c.lineTo(mx + 10 * fa, 0);
      c.stroke();
      c.globalCompositeOperation = "source-over";
    }
    c.restore();
    c.restore(); // root

    // muzzle world light
    if (p.flash > 0) {
      const mzx = p.x + Math.cos(p.aim) * (gunLen + 4) - cam;
      const mzy = p.y + bob + Math.sin(p.aim) * (gunLen + 4) + camY;
      this.ctx.globalCompositeOperation = "lighter";
      const lg = this.ctx.createRadialGradient(mzx, mzy, 4, mzx, mzy, 120);
      lg.addColorStop(0, `rgba(251,191,36,${0.16 * clamp(p.flash * 16, 0, 1)})`);
      lg.addColorStop(1, "rgba(251,191,36,0)");
      this.ctx.fillStyle = lg;
      this.ctx.fillRect(mzx - 120, mzy - 120, 240, 240);
      this.ctx.globalCompositeOperation = "source-over";
    }
  }
}
