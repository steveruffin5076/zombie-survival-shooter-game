import { AMMO_ITEMS, CONSUMABLE_ITEMS, ITEMS } from "./items";

export type CrateTier = 1 | 2 | 3;

export interface LootDrop {
  itemId: string;
}

interface Pool {
  count: [number, number];
  weights: Array<{ itemId: string; weight: number }>;
}

/** Tier 2/3 crates are worth the risk (and refuse to open above threat 0.5). */
const POOLS: Record<CrateTier, Pool> = {
  1: {
    count: [1, 2],
    weights: [
      { itemId: "ammo_pistol", weight: 5 },
      { itemId: "bandage", weight: 4 },
      { itemId: "decoy", weight: 3 },
      { itemId: "ammo_smg", weight: 2 },
    ],
  },
  2: {
    count: [2, 3],
    weights: [
      { itemId: "ammo_smg", weight: 4 },
      { itemId: "ammo_shotgun", weight: 3 },
      { itemId: "ammo_carbine", weight: 3 },
      { itemId: "bandage", weight: 3 },
      { itemId: "grenade", weight: 3 },
      { itemId: "decoy", weight: 2 },
    ],
  },
  3: {
    count: [2, 4],
    weights: [
      { itemId: "ammo_carbine", weight: 4 },
      { itemId: "grenade", weight: 4 },
      { itemId: "stim", weight: 3 },
      { itemId: "bandage", weight: 2 },
      { itemId: "ammo_shotgun", weight: 3 },
    ],
  },
};

function pick(weights: Array<{ itemId: string; weight: number }>, rng: () => number): string {
  const total = weights.reduce((a, b) => a + b.weight, 0);
  let roll = rng() * total;
  for (const w of weights) {
    roll -= w.weight;
    if (roll < 0) return w.itemId;
  }
  return weights[weights.length - 1].itemId;
}

/** Rolls a crate's contents. `rng` is injected so this is deterministic under test. */
export function rollLoot(tier: CrateTier, rng: () => number = Math.random): LootDrop[] {
  const pool = POOLS[tier];
  const [lo, hi] = pool.count;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const drops: LootDrop[] = [];
  for (let i = 0; i < n; i++) drops.push({ itemId: pick(pool.weights, rng) });
  return drops;
}

export function isAmmoItem(itemId: string): boolean {
  return AMMO_ITEMS.includes(itemId);
}

export function isConsumableItem(itemId: string): boolean {
  return CONSUMABLE_ITEMS.includes(itemId);
}

export function itemExists(itemId: string): boolean {
  return itemId in ITEMS;
}
