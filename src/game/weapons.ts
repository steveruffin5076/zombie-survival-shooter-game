export type WeaponClass = "pistol" | "smg" | "shotgun" | "carbine";

export interface WeaponDef {
  id: string;
  name: string;
  short: string;
  cls: WeaponClass;
  rpm: number;
  damage: number;
  fireRate: number;
  projectiles: number;
  spread: number;
  jitter: number;
  speed: number;
  pierce: number;
  knock: number;
  recoil: number;
  shake: number;
  /** magazine capacity */
  mag: number;
  /** spare rounds carried. -1 = unlimited (pistols only) */
  reserve: number;
  reload: number;
  moveMul: number;
  swap: number;
  critBonus: number;
  /** EFFECTIVE RANGE — laser sight length + hard damage falloff (px) */
  range: number;
  /** NOISE RADIUS — how much threat one shot generates (px) */
  noise: number;
  /** SUPPRESSOR DURABILITY — shots before it shatters */
  supp: number;
  /** trigger-limited, not cyclic — no full-auto hold-to-fire */
  semiAuto?: boolean;
  /** multiplier on the pivot turn-delay; 1 = baseline */
  pivotMul?: number;
  /** hideout mag upgrade tiers — data only, not read until the hideout exists */
  magUpgrades?: number[];
  desc: string;
}

const rps = (rpm: number) => rpm / 60;

/* screen is 1280 wide — range/noise are expressed in screen fractions */
const SCREEN = 1280;
const RANGE = {
  pistol: SCREEN * 0.3,    // short
  smg: SCREEN * 0.42,      // medium-short
  shotgun: SCREEN * 0.19,  // very short
  carbine: SCREEN * 0.78,  // medium-long
};
const NOISE = {
  pistol: SCREEN * 0.25,   // short
  smg: SCREEN * 0.5,       // medium
  carbine: SCREEN * 1.0,   // long — full screen
  shotgun: SCREEN * 1.5,   // extreme
};

export const WEAPONS: Record<string, WeaponDef> = {
  /* ---------------- PISTOLS — unlimited reserve, high suppressor life ---------------- */
  glock18: {
    id: "glock18", name: "Glock 18", short: "GLOCK 18", cls: "pistol",
    rpm: 1200, damage: 6, fireRate: rps(1200), projectiles: 1, spread: 0, jitter: 0.05,
    speed: 900, pierce: 0, knock: 26, recoil: 9, shake: 0.5,
    mag: 17, reserve: -1, reload: 1.0, moveMul: 1.14, swap: 0.07, critBonus: 0.1,
    range: RANGE.pistol, noise: NOISE.pistol, supp: 40,
    desc: "Full-auto panic button. Infinite reserve, 17-round mag.",
  },
  p365: {
    id: "p365", name: "SIG Sauer P365", short: "P365", cls: "pistol",
    // semi-auto, no cyclic rate — trigger-limited, not the Glock 18's full-auto cyclic
    rpm: 330, damage: 16, fireRate: rps(330), projectiles: 1, spread: 0, jitter: 0.03,
    speed: 920, pierce: 0, knock: 34, recoil: 14, shake: 0.7,
    mag: 12, reserve: -1, reload: 0.95, moveMul: 1.10, swap: 0.06, critBonus: 0.12,
    range: RANGE.pistol * 0.95, noise: NOISE.pistol, supp: 40,
    semiAuto: true, pivotMul: 0.90, magUpgrades: [15, 17],
    desc: "Micro-compact 9×19, semi-auto. Infinite reserve, 12-round mag, fastest handling.",
  },
  tec9: {
    id: "tec9", name: "TEC-9", short: "TEC-9", cls: "pistol",
    rpm: 600, damage: 13, fireRate: rps(600), projectiles: 1, spread: 0, jitter: 0.022,
    speed: 950, pierce: 0, knock: 40, recoil: 18, shake: 0.9,
    mag: 32, reserve: -1, reload: 1.2, moveMul: 1.12, swap: 0.09, critBonus: 0.16,
    range: RANGE.pistol * 1.1, noise: NOISE.pistol, supp: 44,
    desc: "32-round mag, infinite reserve. Pops single heads efficiently.",
  },
  deagle: {
    id: "deagle", name: "Desert Eagle .50", short: "DEAGLE", cls: "pistol",
    rpm: 180, damage: 62, fireRate: rps(180), projectiles: 1, spread: 0, jitter: 0.008,
    speed: 1500, pierce: 2, knock: 300, recoil: 85, shake: 4.4,
    mag: 7, reserve: -1, reload: 1.5, moveMul: 1.04, swap: 0.16, critBonus: 0.2,
    range: RANGE.pistol * 1.35, noise: NOISE.pistol * 2.2, supp: 18,
    desc: "Extreme damage, pierces 3. Loud — wrecks suppressors fast.",
  },

  /* ---------------- SMGs — limited reserve, medium suppressor ---------------- */
  bizon: {
    id: "bizon", name: "PP-19 Bizon", short: "BIZON", cls: "smg",
    rpm: 700, damage: 9, fireRate: rps(700), projectiles: 1, spread: 0, jitter: 0.03,
    speed: 980, pierce: 0, knock: 30, recoil: 11, shake: 0.6,
    mag: 64, reserve: 192, reload: 2.0, moveMul: 1.12, swap: 0.14, critBonus: 0,
    range: RANGE.smg, noise: NOISE.smg, supp: 34,
    desc: "64-round helical drum. Fire long after everyone else reloads.",
  },
  p90: {
    id: "p90", name: "FN P90", short: "P90", cls: "smg",
    rpm: 900, damage: 8.5, fireRate: rps(900), projectiles: 1, spread: 0, jitter: 0.026,
    speed: 1050, pierce: 1, knock: 26, recoil: 10, shake: 0.6,
    mag: 50, reserve: 150, reload: 1.7, moveMul: 1.15, swap: 0.12, critBonus: 0.04,
    range: RANGE.smg * 1.1, noise: NOISE.smg, supp: 30,
    desc: "50 AP rounds. Penetrates tightly packed groups.",
  },
  vector: {
    id: "vector", name: "KRISS Vector", short: "VECTOR", cls: "smg",
    rpm: 1200, damage: 7.5, fireRate: rps(1200), projectiles: 1, spread: 0, jitter: 0.02,
    speed: 1000, pierce: 0, knock: 22, recoil: 8, shake: 0.5,
    mag: 30, reserve: 120, reload: 1.4, moveMul: 1.18, swap: 0.1, critBonus: 0.06,
    range: RANGE.smg * 0.95, noise: NOISE.smg, supp: 26,
    desc: "Melts bosses. Full-auto shreds suppressors in seconds.",
  },

  /* ---------------- SHOTGUNS — extreme noise, ultra-low suppressor ---------------- */
  aa12: {
    id: "aa12", name: "MPS AA-12", short: "AA-12", cls: "shotgun",
    rpm: 300, damage: 10, fireRate: rps(300), projectiles: 6, spread: 0.14, jitter: 0.05,
    speed: 760, pierce: 0, knock: 150, recoil: 70, shake: 4.4,
    mag: 20, reserve: 60, reload: 2.6, moveMul: 0.86, swap: 0.3, critBonus: 0,
    range: RANGE.shotgun, noise: NOISE.shotgun, supp: 5,
    desc: "Full-auto drum. Liquefies groups — and screams to the whole map.",
  },
  origin12: {
    id: "origin12", name: "Origin 12", short: "ORIGIN 12", cls: "shotgun",
    rpm: 250, damage: 12, fireRate: rps(250), projectiles: 7, spread: 0.105, jitter: 0.03,
    speed: 800, pierce: 0, knock: 170, recoil: 78, shake: 4.6,
    mag: 20, reserve: 60, reload: 2.5, moveMul: 0.88, swap: 0.28, critBonus: 0,
    range: RANGE.shotgun * 1.15, noise: NOISE.shotgun * 0.92, supp: 6,
    desc: "Semi-auto drum, tighter control. Pace your blasts.",
  },
  benelli: {
    id: "benelli", name: "Benelli M4", short: "BENELLI", cls: "shotgun",
    rpm: 240, damage: 15, fireRate: rps(240), projectiles: 9, spread: 0.13, jitter: 0.035,
    speed: 820, pierce: 0, knock: 210, recoil: 92, shake: 5.0,
    mag: 7, reserve: 56, reload: 1.6, moveMul: 0.92, swap: 0.24, critBonus: 0,
    range: RANGE.shotgun * 1.2, noise: NOISE.shotgun, supp: 5,
    desc: "7 shells, devastating. Fast tube reload between lulls.",
  },

  /* ---------------- CARBINES — longest range, lowest suppressor life ---------------- */
  hk416: {
    id: "hk416", name: "HK416", short: "HK416", cls: "carbine",
    rpm: 850, damage: 15, fireRate: rps(850), projectiles: 1, spread: 0, jitter: 0.014,
    speed: 1350, pierce: 0, knock: 55, recoil: 30, shake: 1.7,
    mag: 30, reserve: 120, reload: 2.0, moveMul: 1.0, swap: 0.18, critBonus: 0.04,
    range: RANGE.carbine, noise: NOISE.carbine, supp: 20,
    desc: "Reliable and fast. Plays like a lightweight LMG.",
  },
  m4a1: {
    id: "m4a1", name: "Colt M4A1", short: "M4A1", cls: "carbine",
    rpm: 800, damage: 15, fireRate: rps(800), projectiles: 1, spread: 0, jitter: 0.008,
    speed: 1400, pierce: 0, knock: 52, recoil: 24, shake: 1.4,
    mag: 30, reserve: 120, reload: 1.9, moveMul: 1.02, swap: 0.17, critBonus: 0.1,
    range: RANGE.carbine * 1.05, noise: NOISE.carbine, supp: 22,
    desc: "Manageable recoil — the highest crit chance of any carbine.",
  },
  asval: {
    id: "asval", name: "AS Val", short: "AS VAL", cls: "carbine",
    rpm: 900, damage: 19, fireRate: rps(900), projectiles: 1, spread: 0, jitter: 0.012,
    speed: 1250, pierce: 2, knock: 48, recoil: 26, shake: 1.2,
    mag: 20, reserve: 100, reload: 2.1, moveMul: 1.0, swap: 0.19, critBonus: 0.06,
    // integrally suppressed: tiny noise, and its "suppressor" never shatters
    range: RANGE.carbine * 0.9, noise: NOISE.carbine * 0.12, supp: 999,
    desc: "Integrally suppressed subsonic AP. Clears pockets without waking the horde.",
  },
};

export const CLASS_ORDER: WeaponClass[] = ["pistol", "smg", "shotgun", "carbine"];

export const CLASS_LABEL: Record<WeaponClass, string> = {
  pistol: "PISTOL", smg: "SMG", shotgun: "SHOTGUN", carbine: "CARBINE",
};

export const CLASS_ROLE: Record<WeaponClass, string> = {
  pistol: "BACKUP", smg: "RUN & GUN", shotgun: "CLOSE QUARTERS", carbine: "MARKSMAN",
};

export const WEAPON_IDS = Object.keys(WEAPONS);
export const byClass = (cls: WeaponClass) => WEAPON_IDS.filter((id) => WEAPONS[id].cls === cls);
export const STARTER = "p365";
