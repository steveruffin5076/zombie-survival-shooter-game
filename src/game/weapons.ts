export type WeaponClass = "pistol" | "smg" | "shotgun" | "carbine";

export interface WeaponDef {
  id: string;
  name: string;
  short: string;
  cls: WeaponClass;
  /** real-world rate of fire, shown on cards */
  rpm: number;
  /** base damage per projectile */
  damage: number;
  /** shots per second (derived from rpm) */
  fireRate: number;
  projectiles: number;
  /** angular spread between pellets (radians) */
  spread: number;
  /** hip-fire inaccuracy (radians) — lower is tighter */
  jitter: number;
  /** projectile velocity px/s */
  speed: number;
  /** projectile lifetime — the real range limiter */
  life: number;
  pierce: number;
  /** knockback applied to zombies on hit */
  knock: number;
  recoil: number;
  shake: number;
  /** magazine capacity (reserve ammo is unlimited) */
  mag: number;
  reload: number;
  /** movement speed multiplier while equipped */
  moveMul: number;
  /** seconds before you can fire after swapping in */
  swap: number;
  critBonus: number;
  /** quieter guns draw fewer wandering zombies (flavor + spawn aggro) */
  quiet?: boolean;
  desc: string;
}

const rps = (rpm: number) => rpm / 60;

export const WEAPONS: Record<string, WeaponDef> = {
  /* ---------------- PISTOLS — sidearms / backup ---------------- */
  glock18: {
    id: "glock18", name: "Glock 18", short: "GLOCK 18", cls: "pistol",
    rpm: 1200, damage: 6, fireRate: rps(1200), projectiles: 1, spread: 0, jitter: 0.05,
    speed: 900, life: 1.2, pierce: 0, knock: 26, recoil: 9, shake: 0.5,
    mag: 17, reload: 1.0, moveMul: 1.14, swap: 0.07, critBonus: 0.1,
    desc: "Full-auto panic button. Spray down a wall of infected while backpedalling.",
  },
  tec9: {
    id: "tec9", name: "TEC-9", short: "TEC-9", cls: "pistol",
    rpm: 600, damage: 13, fireRate: rps(600), projectiles: 1, spread: 0, jitter: 0.022,
    speed: 950, life: 1.4, pierce: 0, knock: 40, recoil: 18, shake: 0.9,
    mag: 32, reload: 1.2, moveMul: 1.12, swap: 0.09, critBonus: 0.16,
    desc: "Huge pistol ammo pool. Pops single heads while preserving primary ammo.",
  },
  deagle: {
    id: "deagle", name: "Desert Eagle .50", short: "DEAGLE", cls: "pistol",
    rpm: 180, damage: 62, fireRate: rps(180), projectiles: 1, spread: 0, jitter: 0.008,
    speed: 1500, life: 2.2, pierce: 2, knock: 300, recoil: 85, shake: 4.4,
    mag: 7, reload: 1.5, moveMul: 1.04, swap: 0.16, critBonus: 0.2,
    desc: "Extreme damage. Massive stagger, punches through 2-3 zombies in a line.",
  },

  /* ---------------- SMGs — horde shredding / mobility ---------------- */
  bizon: {
    id: "bizon", name: "PP-19 Bizon", short: "BIZON", cls: "smg",
    rpm: 700, damage: 9, fireRate: rps(700), projectiles: 1, spread: 0, jitter: 0.03,
    speed: 980, life: 0.95, pierce: 0, knock: 30, recoil: 11, shake: 0.6,
    mag: 64, reload: 2.0, moveMul: 1.12, swap: 0.14, critBonus: 0,
    desc: "64-round helical drum. Keep firing long after everyone else reloads.",
  },
  p90: {
    id: "p90", name: "FN P90", short: "P90", cls: "smg",
    rpm: 900, damage: 8.5, fireRate: rps(900), projectiles: 1, spread: 0, jitter: 0.026,
    speed: 1050, life: 1.05, pierce: 1, knock: 26, recoil: 10, shake: 0.6,
    mag: 50, reload: 1.7, moveMul: 1.15, swap: 0.12, critBonus: 0.04,
    desc: "50 AP rounds. Excellent penetration through tightly packed groups.",
  },
  vector: {
    id: "vector", name: "KRISS Vector", short: "VECTOR", cls: "smg",
    rpm: 1200, damage: 7.5, fireRate: rps(1200), projectiles: 1, spread: 0, jitter: 0.02,
    speed: 1000, life: 0.9, pierce: 0, knock: 22, recoil: 8, shake: 0.5,
    mag: 30, reload: 1.4, moveMul: 1.18, swap: 0.1, critBonus: 0.06,
    desc: "Unmatched single-target DPS. Melts bosses — but reloads constantly.",
  },

  /* ---------------- SHOTGUNS — crowd control ---------------- */
  aa12: {
    id: "aa12", name: "MPS AA-12", short: "AA-12", cls: "shotgun",
    rpm: 300, damage: 10, fireRate: rps(300), projectiles: 6, spread: 0.14, jitter: 0.05,
    speed: 760, life: 0.36, pierce: 0, knock: 150, recoil: 70, shake: 4.4,
    mag: 20, reload: 2.6, moveMul: 0.86, swap: 0.3, critBonus: 0,
    desc: "Full-auto 20-round drum. Liquefies entire groups and clears doorways.",
  },
  origin12: {
    id: "origin12", name: "Origin 12", short: "ORIGIN 12", cls: "shotgun",
    rpm: 250, damage: 12, fireRate: rps(250), projectiles: 7, spread: 0.105, jitter: 0.03,
    speed: 800, life: 0.4, pierce: 0, knock: 170, recoil: 78, shake: 4.6,
    mag: 20, reload: 2.5, moveMul: 0.88, swap: 0.28, critBonus: 0,
    desc: "Semi-auto drum with tighter control. Pace your blasts down a hallway.",
  },
  benelli: {
    id: "benelli", name: "Benelli M4", short: "BENELLI", cls: "shotgun",
    rpm: 240, damage: 15, fireRate: rps(240), projectiles: 9, spread: 0.13, jitter: 0.035,
    speed: 820, life: 0.42, pierce: 0, knock: 210, recoil: 92, shake: 5.0,
    mag: 7, reload: 1.6, moveMul: 0.92, swap: 0.24, critBonus: 0,
    desc: "Only 7 shells but devastating, and the tube reloads fast between lulls.",
  },

  /* ---------------- CARBINES — versatile workhorse ---------------- */
  hk416: {
    id: "hk416", name: "HK416", short: "HK416", cls: "carbine",
    rpm: 850, damage: 15, fireRate: rps(850), projectiles: 1, spread: 0, jitter: 0.014,
    speed: 1350, life: 1.9, pierce: 0, knock: 55, recoil: 30, shake: 1.7,
    mag: 30, reload: 2.0, moveMul: 1.0, swap: 0.18, critBonus: 0.04,
    desc: "Reliable and fast. With a drum it plays like a lightweight LMG.",
  },
  m4a1: {
    id: "m4a1", name: "Colt M4A1", short: "M4A1", cls: "carbine",
    rpm: 800, damage: 15, fireRate: rps(800), projectiles: 1, spread: 0, jitter: 0.008,
    speed: 1400, life: 2.0, pierce: 0, knock: 52, recoil: 24, shake: 1.4,
    mag: 30, reload: 1.9, moveMul: 1.02, swap: 0.17, critBonus: 0.1,
    desc: "Highly manageable recoil — bullets land on the head hitbox consistently.",
  },
  asval: {
    id: "asval", name: "AS Val", short: "AS VAL", cls: "carbine",
    rpm: 900, damage: 19, fireRate: rps(900), projectiles: 1, spread: 0, jitter: 0.012,
    speed: 1250, life: 1.8, pierce: 2, knock: 48, recoil: 26, shake: 1.2,
    mag: 20, reload: 2.1, moveMul: 1.0, swap: 0.19, critBonus: 0.06, quiet: true,
    desc: "Suppressed subsonic AP. Very high damage, and it won't wake the horde.",
  },
};

export const CLASS_ORDER: WeaponClass[] = ["pistol", "smg", "shotgun", "carbine"];

export const CLASS_LABEL: Record<WeaponClass, string> = {
  pistol: "PISTOL",
  smg: "SMG",
  shotgun: "SHOTGUN",
  carbine: "CARBINE",
};

export const CLASS_ROLE: Record<WeaponClass, string> = {
  pistol: "BACKUP",
  smg: "RUN & GUN",
  shotgun: "CLOSE QUARTERS",
  carbine: "WORKHORSE",
};

export const WEAPON_IDS = Object.keys(WEAPONS);

export const byClass = (cls: WeaponClass) =>
  WEAPON_IDS.filter((id) => WEAPONS[id].cls === cls);

export const STARTER = "glock18";
