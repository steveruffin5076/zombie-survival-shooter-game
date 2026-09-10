/** Pure types + timing/attack-selection logic for boss fights. No engine state. */

export type BossAttack = "slam" | "mortar" | "call" | "shieldcharge";

export const BOSS_WINDUP: Record<BossAttack, number> = { slam: 1.9, mortar: 1.1, call: 1.4, shieldcharge: 1.3 };

/** Ground Slam's windup shrinks with the boss's phase but never below this floor —
 * later phases add density (faster attack cadence), never steal reaction time.
 * A property of the attack itself, so every boss that uses "slam" shares it. */
export const SLAM_WINDUP_FLOOR = 1.6;

export function slamWindup(phase: 0 | 1 | 2): number {
  return Math.max(SLAM_WINDUP_FLOOR, BOSS_WINDUP.slam - phase * 0.15);
}

/** A boss's full tuning: its attack pool, timing, stats, and display copy. */
export interface BossDef {
  id: string;
  /** HUD boss-bar label */
  name: string;
  /** spawn-announcement bracket text, e.g. "◤ THE JUGGERNAUT ALPHA ◢" */
  tellName: string;
  tellSub: string;
  deathBanner: string;
  deathSub: string;
  /** this boss's attack pool for pickAttack() — need not be all 4 BossAttacks */
  attacks: BossAttack[];
  /** per-attack windup overrides; "slam" ignores this and always uses slamWindup(phase) */
  windup: Partial<Record<BossAttack, number>>;
  /** extra multiplier on top of the standard power-scaled boss hp formula */
  hpMul: number;
  scale: number;
  r: number;
  /** base body color — drawBoss() shades this into torso/head/limb tones */
  color: string;
  cooldownBase: number;
  cooldownStep: number;
  /** draws a riot-shield accessory over the forward arm */
  shield?: boolean;
}

export const BOSS_DEFS: Record<string, BossDef> = {
  juggernaut: {
    id: "juggernaut", name: "THE JUGGERNAUT ALPHA",
    tellName: "◤ THE JUGGERNAUT ALPHA ◢", tellSub: "it doesn't flinch",
    deathBanner: "THE JUGGERNAUT FALLS", deathSub: "it's not getting back up",
    attacks: ["slam", "mortar", "call"],
    windup: {},
    hpMul: 1, scale: 2.1, r: 40, color: "#3a2c1e",
    cooldownBase: 1.8, cooldownStep: 0.45,
  },
  neighborhood_watch: {
    id: "neighborhood_watch", name: "THE NEIGHBORHOOD WATCH",
    tellName: "◤ THE NEIGHBORHOOD WATCH ◢", tellSub: "badge and baton, nothing left to protect",
    deathBanner: "THE WATCH STANDS DOWN", deathSub: "the badge finally comes off",
    attacks: ["shieldcharge", "mortar", "call"],
    windup: { shieldcharge: 1.3 },
    hpMul: 0.8, scale: 1.85, r: 34, color: "#1c2b3a",
    cooldownBase: 1.6, cooldownStep: 0.35,
    shield: true,
  },
};

/** Display label for a windup/HUD readout — one per attack, boss-agnostic. */
export const ATTACK_LABELS: Record<BossAttack, string> = {
  slam: "GROUND SLAM", mortar: "PUKE MORTAR", call: "SCREAMING CALL", shieldcharge: "SHIELD CHARGE",
};

/** Windup for an attack at a given phase, per the boss's own def (defaults to the
 * Juggernaut's — every existing call site + test keeps working unmodified). */
export function windupFor(attack: BossAttack, phase: 0 | 1 | 2, def: BossDef = BOSS_DEFS.juggernaut): number {
  if (attack === "slam") return slamWindup(phase);
  return def.windup[attack] ?? BOSS_WINDUP[attack];
}

/** Rest between an attack landing and the next windup starting — also shrinks with phase. */
export function cooldownFor(phase: 0 | 1 | 2, def: BossDef = BOSS_DEFS.juggernaut): number {
  return Math.max(0.9, def.cooldownBase - phase * def.cooldownStep);
}

/** Next attack: even odds across the rest of the pool — the same one never fires twice in a row. */
export function pickAttack(last: BossAttack | null, pool: BossAttack[] = ["slam", "mortar", "call"]): BossAttack {
  const choices = pool.filter((a) => a !== last);
  return choices[Math.floor(Math.random() * choices.length)];
}

/** Enrage phase from remaining hp fraction — 3 bands, matching the HUD's 3-segment bar. */
export function phaseFor(hpPct: number): 0 | 1 | 2 {
  if (hpPct > 2 / 3) return 0;
  if (hpPct > 1 / 3) return 1;
  return 2;
}

/** Minimal shape auto-aim needs to lock onto something — a Zombie or the Boss — without a cast. */
export interface AimTarget {
  x: number;
  y: number;
  dead: boolean;
  r: number;
  scale: number;
}
