/**
 * Player-facing zombie compendium data — deliberately separate from engine.ts's
 * internal ZCONF/ZType. This is display copy for the Survival Profile screen,
 * not a balance table; the engine's own stats are the source of truth for
 * actual gameplay numbers. Speed labels are calibrated against the player's
 * own base move speed (~150) and walker's speed (52) as the "slow" baseline.
 */

export type ZombieInfoId = "walker" | "runner" | "spitter" | "brute" | "screamer";

export interface ZombieInfo {
  id: ZombieInfoId;
  name: string;
  tint: string;
  /** 1 (slowest) .. 5 (fastest), for the speed bar */
  speedTier: 1 | 2 | 3 | 4 | 5;
  speedLabel: string;
  attackStyle: string;
  notes: string;
}

export const ZOMBIE_INFO: ZombieInfo[] = [
  {
    id: "walker",
    name: "Walker",
    tint: "#6d8560",
    speedTier: 2,
    speedLabel: "Slow, steady shamble",
    attackStyle: "Melee bite on contact",
    notes: "The baseline threat — never fast or fragile enough to ignore, never scary alone.",
  },
  {
    id: "runner",
    name: "Runner",
    tint: "#8a5a3a",
    speedTier: 5,
    speedLabel: "Fast — outpaces the player",
    attackStyle: "Melee bite, closes distance quickly",
    notes: "Low HP — dies fast once you land a shot, but punishes hesitation by closing the gap first.",
  },
  {
    id: "spitter",
    name: "Spitter",
    tint: "#4a6b3a",
    speedTier: 2,
    speedLabel: "Slow, keeps its distance",
    attackStyle: "Ranged acid spit — kites instead of closing in",
    notes: "The only ranged threat — will back off if you approach, so it can chip you from range if ignored.",
  },
  {
    id: "brute",
    name: "Brute",
    tint: "#5a4a3a",
    speedTier: 1,
    speedLabel: "Very slow lumber",
    attackStyle: "Heavy melee slam — high damage, larger knockback",
    notes: "A tank: high HP and hits hard, but its speed means it's always outrunnable in the open.",
  },
  {
    id: "screamer",
    name: "Screamer",
    tint: "#7a6a8a",
    speedTier: 2,
    speedLabel: "Slow, wary",
    attackStyle: "Weak melee — her real attack is a scream that calls an ambush",
    notes: "Fragile — worth killing fast and clean before her alert timer fires, or she calls in a horde from behind.",
  },
];
