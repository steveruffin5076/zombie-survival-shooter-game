/** Pure types + timing/attack-selection logic for the Juggernaut Alpha fight. No engine state. */

export type BossAttack = "slam" | "mortar" | "call";

export const BOSS_WINDUP: Record<BossAttack, number> = { slam: 1.9, mortar: 1.1, call: 1.4 };

/** Ground Slam's windup shrinks with the boss's phase but never below this floor —
 * later phases add density (faster attack cadence), never steal reaction time. */
export const SLAM_WINDUP_FLOOR = 1.6;

export function slamWindup(phase: 0 | 1 | 2): number {
  return Math.max(SLAM_WINDUP_FLOOR, BOSS_WINDUP.slam - phase * 0.15);
}

export function windupFor(attack: BossAttack, phase: 0 | 1 | 2): number {
  return attack === "slam" ? slamWindup(phase) : BOSS_WINDUP[attack];
}

/** Rest between an attack landing and the next windup starting — also shrinks with phase. */
export function cooldownFor(phase: 0 | 1 | 2): number {
  return Math.max(0.9, 1.8 - phase * 0.45);
}

/** Next attack: even odds across the other two — the same one never fires twice in a row. */
export function pickAttack(last: BossAttack | null): BossAttack {
  const pool = (["slam", "mortar", "call"] as BossAttack[]).filter((a) => a !== last);
  return pool[Math.floor(Math.random() * pool.length)];
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
