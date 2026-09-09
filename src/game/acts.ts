/**
 * The 6-Act campaign structure from `enhancement-1.md`. Pure data — `stages.ts`
 * flattens this into the 24-row `STAGES` table the engine actually reads.
 *
 * Only Act I is real content (it's today's already-tuned 4 stages, relabeled,
 * now fighting The Neighborhood Watch and facing the act-specific Screamer).
 * Acts II-VI are thin stub rows — reused themes, each naming its own intended
 * future boss (no `BOSS_DEFS` entry yet, so `spawnBoss()` falls back to the
 * Juggernaut) — so the mission is winnable end-to-end before each act's own
 * phase lands.
 */

export interface ActStageDef {
  name: string;
  sub: string;
  themeId: string;
  worldW: number;
  /** true only for an act's 4th stage — the fixed-camera Terminal Defense */
  fixedCamera?: boolean;
}

export interface ActDef {
  id: number;
  numeral: string;
  name: string;
  sub: string;
  /** the Terminal Defense stage's unique boss — not yet consumed by spawnBoss() */
  bossId: string;
  /** exactly 4: 3 exploration stages + 1 Terminal Defense (index 3, fixedCamera) */
  stages: ActStageDef[];
  /** act-specific spawn weights (e.g. the Screamer), keyed by ZType id */
  enemyPool?: Partial<Record<string, number>>;
}

export const ACTS: ActDef[] = [
  {
    id: 1, numeral: "I", name: "THE SUBURBAN STATIC", sub: "day 90 after redshift",
    bossId: "neighborhood_watch",
    // the Screamer — a fragile, act-specific enemy per enhancement-1.md;
    // a flat weight (not power-scaled like the base roster) keeps her a
    // rare, deliberate encounter rather than common fodder
    enemyPool: { screamer: 0.18 },
    stages: [
      { name: "THE CEMETERY", sub: "where it all began", themeId: "cemetery", worldW: 2880 },
      { name: "RUINED SUBURBS", sub: "nothing left to save", themeId: "suburbs", worldW: 2880 },
      { name: "THE HIGHWAY", sub: "keep moving forward", themeId: "highway", worldW: 2880 },
      { name: "GROUND ZERO", sub: "the end of the night", themeId: "arena", worldW: 1600, fixedCamera: true },
    ],
  },
  {
    id: 2, numeral: "II", name: "THE HIGHWAY BARRICADE", sub: "coming soon",
    bossId: "stalker",
    stages: [
      { name: "SECTOR II-1", sub: "coming soon", themeId: "highway", worldW: 2880 },
      { name: "SECTOR II-2", sub: "coming soon", themeId: "highway", worldW: 2880 },
      { name: "SECTOR II-3", sub: "coming soon", themeId: "highway", worldW: 2880 },
      { name: "SECTOR II-4", sub: "coming soon", themeId: "arena", worldW: 1600, fixedCamera: true },
    ],
  },
  {
    id: 3, numeral: "III", name: "THE INDUSTRIAL CHOKE", sub: "coming soon",
    bossId: "assembler",
    stages: [
      { name: "SECTOR III-1", sub: "coming soon", themeId: "suburbs", worldW: 2880 },
      { name: "SECTOR III-2", sub: "coming soon", themeId: "suburbs", worldW: 2880 },
      { name: "SECTOR III-3", sub: "coming soon", themeId: "suburbs", worldW: 2880 },
      { name: "SECTOR III-4", sub: "coming soon", themeId: "arena", worldW: 1600, fixedCamera: true },
    ],
  },
  {
    id: 4, numeral: "IV", name: "THE QUARANTINE ZONE", sub: "coming soon",
    bossId: "juggernaut",
    stages: [
      { name: "SECTOR IV-1", sub: "coming soon", themeId: "cemetery", worldW: 2880 },
      { name: "SECTOR IV-2", sub: "coming soon", themeId: "cemetery", worldW: 2880 },
      { name: "SECTOR IV-3", sub: "coming soon", themeId: "cemetery", worldW: 2880 },
      { name: "SECTOR IV-4", sub: "coming soon", themeId: "arena", worldW: 1600, fixedCamera: true },
    ],
  },
  {
    id: 5, numeral: "V", name: "THE NEON CORE", sub: "coming soon",
    bossId: "core_sentinel",
    stages: [
      { name: "SECTOR V-1", sub: "coming soon", themeId: "highway", worldW: 2880 },
      { name: "SECTOR V-2", sub: "coming soon", themeId: "highway", worldW: 2880 },
      { name: "SECTOR V-3", sub: "coming soon", themeId: "highway", worldW: 2880 },
      { name: "SECTOR V-4", sub: "coming soon", themeId: "arena", worldW: 1600, fixedCamera: true },
    ],
  },
  {
    id: 6, numeral: "VI", name: "PROJECT: DARK LENS", sub: "coming soon",
    // per enhancement-1.md, Act VI's own structure is a special gauntlet run,
    // not 3-exploration-plus-1-defense — deferred past this vertical slice,
    // stubbed here in the same 4-stage shape as every other act for now
    bossId: "juggernaut",
    stages: [
      { name: "SECTOR VI-1", sub: "coming soon", themeId: "suburbs", worldW: 2880 },
      { name: "SECTOR VI-2", sub: "coming soon", themeId: "suburbs", worldW: 2880 },
      { name: "SECTOR VI-3", sub: "coming soon", themeId: "suburbs", worldW: 2880 },
      { name: "SECTOR VI-4", sub: "coming soon", themeId: "arena", worldW: 1600, fixedCamera: true },
    ],
  },
];

/** An act's extra spawn weights (e.g. the Screamer), or {} if it has none. */
export function enemyPoolFor(actId: number): Partial<Record<string, number>> {
  return ACTS[actId - 1]?.enemyPool ?? {};
}

/**
 * Weighted pick across a spawn-weight table, keyed by ZType id (kept as a
 * plain string here — acts.ts doesn't depend on engine.ts's private types).
 * `rng` is injected so this is deterministic under test, same pattern as
 * `rollLoot` in loot.ts.
 */
export function rollEnemy(weights: Partial<Record<string, number>>, rng: () => number = Math.random): string {
  const entries = Object.entries(weights).filter((e): e is [string, number] => (e[1] ?? 0) > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [type, w] of entries) {
    roll -= w;
    if (roll < 0) return type;
  }
  return entries[entries.length - 1][0];
}
