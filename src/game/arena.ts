/** Pure data + placement rules for Stage 4's deployables. No engine state. */

export type DeployableKind = "barricade" | "wire" | "claymore";

export interface DeployableDef {
  kind: DeployableKind;
  name: string;
  short: string;
  hp: number;
  /** scrap cost to place a fresh one */
  buildCost: number;
  /** scrap cost to fully repair a damaged one */
  repairCost: number;
  desc: string;
}

export const DEPLOYABLE_DEFS: Record<DeployableKind, DeployableDef> = {
  barricade: {
    kind: "barricade", name: "Barricade", short: "WALL", hp: 220, buildCost: 4, repairCost: 2,
    desc: "Blocks the lane — zombies stop and tear it down instead of reaching you. Spitters arc over it.",
  },
  wire: {
    kind: "wire", name: "Razor Wire", short: "WIRE", hp: 90, buildCost: 2, repairCost: 1,
    desc: "Doesn't stop them, just slows anything that crosses it.",
  },
  claymore: {
    kind: "claymore", name: "Claymore", short: "MINE", hp: 40, buildCost: 3, repairCost: 1,
    desc: "One proximity blast. Holds its trigger through an active ambush instead of wasting it on the first zombie.",
  },
};

export interface Deployable {
  id: string;
  kind: DeployableKind;
  lane: 1 | -1;
  /** 0 = closest to center, increasing outward; must stay < MAX_PER_LANE */
  slot: number;
  hp: number;
  maxHp: number;
  /** claymore only — false once it's fired */
  armed: boolean;
}

export const MAX_PER_LANE = 6;
export const SLOT_WIDTH = 110;

export function canPlaceAt(existing: Deployable[], lane: 1 | -1, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PER_LANE) return false;
  return !existing.some((d) => d.lane === lane && d.slot === slot);
}

/** World-x -> the (lane, slot) nearest it, relative to the arena's centerX. Slot may be out of range. */
export function worldXToSlot(x: number, centerX: number): { lane: 1 | -1; slot: number } {
  const lane: 1 | -1 = x >= centerX ? 1 : -1;
  const dist = Math.abs(x - centerX);
  const slot = Math.floor(dist / SLOT_WIDTH);
  return { lane, slot };
}

export function slotToWorldX(lane: 1 | -1, slot: number, centerX: number): number {
  return centerX + lane * (slot + 0.5) * SLOT_WIDTH;
}

/** The barricade closest to center (lowest slot) in the given lane — the one an approaching zombie hits first. */
export function nearestBarricade(deployables: Deployable[], lane: 1 | -1): Deployable | null {
  const walls = deployables.filter((d) => d.kind === "barricade" && d.lane === lane && d.hp > 0);
  if (walls.length === 0) return null;
  // closest to center first — that's the one a zombie coming from outside hits first
  return walls.reduce((best, d) => (d.slot < best.slot ? d : best), walls[0]);
}
