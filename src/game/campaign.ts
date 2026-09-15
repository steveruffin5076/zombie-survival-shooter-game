/**
 * Story Campaign: the 8 fixed "Shifts" from the Quarantine Protocol radio
 * script, plus the story-flag state they read and write, and the ending
 * that flag state resolves to.
 *
 * Deliberately NOT derived from acts.ts/stages.ts — those drive Endless's
 * 24-stage table that cycles forever via `stageDefFor`'s modulo. A campaign
 * shift is bespoke, one-shot content; wrapping past Shift 8 would replay
 * Shift 1's content under a "Shift 9" label, which is wrong for a campaign
 * with a real ending.
 */

export type ShiftId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface CampaignStageDef {
  shift: ShiftId;
  name: string;
  sub: string;
  clock: string;
  /** narrative-only outside Shift 5 — Shift 5 doubles as the title-screen stage per the doc */
  titleStage?: boolean;
  wavesPerStage: number;
  worldW: number;
  themeId: string;
  /** ZombieInfoId spawn weights for this shift — see zombieInfo.ts for valid ids */
  enemyPool: Partial<Record<string, number>>;
  /** which bespoke mechanic (if any) this shift wires up in engine.ts */
  mechanic?:
    | "quiet-tracking"     // Shift 1 — QUIET_S1
    | "lane-redirect"      // Shift 2
    | "lantern-escort"     // Shift 3 — lantern toggle + Vale escort
    | "wall-break-choice"  // Shift 4 — Brute breaks the wall + Diaz choice
    | "decoy-canister"     // Shift 5 — decoy survivor + canister pickup
    | "badge-lore"         // Shift 6 — proximity lore + vault-door Brute
    | "vault-choice"       // Shift 7
    | "dawn-escape";       // Shift 8 — timer + lamp-crew + endings
}

/** 21:10 to dawn, one night, eight Shifts. Set entirely in Meridian Memorial
 * Cemetery — "cemetery" is the natural theme for most of it; "arena" lends
 * the Vault and the Dawn Gate a harder, more confined read. */
export const CAMPAIGN_STAGES: CampaignStageDef[] = [
  {
    shift: 1, name: "FRONT ROWS", sub: "21:10 — laser tutorial", clock: "21:10",
    wavesPerStage: 3, worldW: 2000, themeId: "cemetery",
    enemyPool: { walker: 100 },
    mechanic: "quiet-tracking",
  },
  {
    shift: 2, name: "SERVICE ROAD", sub: "22:02 — Diaz is hurt", clock: "22:02",
    wavesPerStage: 4, worldW: 2200, themeId: "cemetery",
    enemyPool: { walker: 40, runner: 60 },
    mechanic: "lane-redirect",
  },
  {
    shift: 3, name: "CHAPEL GROUNDS", sub: "22:47 — the ledger is wrong", clock: "22:47",
    wavesPerStage: 5, worldW: 2400, themeId: "cemetery",
    enemyPool: { walker: 30, runner: 30, spitter: 40 },
    mechanic: "lantern-escort",
  },
  {
    shift: 4, name: "OLD ANNEX", sub: "23:40 — the wall doesn't hold", clock: "23:40",
    wavesPerStage: 5, worldW: 2400, themeId: "cemetery",
    enemyPool: { walker: 30, runner: 30, spitter: 20, brute: 20 },
    mechanic: "wall-break-choice",
  },
  {
    shift: 5, name: "THE HOLLOW", sub: "00:15 — Helminth-09", clock: "00:15",
    titleStage: true,
    wavesPerStage: 4, worldW: 2200, themeId: "arena",
    enemyPool: { walker: 25, runner: 25, spitter: 25, screamer: 25 },
    mechanic: "decoy-canister",
  },
  {
    shift: 6, name: "MAUSOLEUM STACK", sub: "01:05 — night security", clock: "01:05",
    wavesPerStage: 5, worldW: 2400, themeId: "cemetery",
    enemyPool: { walker: 25, runner: 25, spitter: 25, brute: 15, screamer: 10 },
    mechanic: "badge-lore",
  },
  {
    shift: 7, name: "VAULT HELMINTH", sub: "02:20 — recover or deny", clock: "02:20",
    wavesPerStage: 4, worldW: 2000, themeId: "arena",
    enemyPool: { walker: 20, runner: 20, spitter: 40, brute: 20 },
    mechanic: "vault-choice",
  },
  {
    shift: 8, name: "DAWN GATE", sub: "04:50 — clock out", clock: "04:50",
    wavesPerStage: 4, worldW: 2400, themeId: "arena",
    enemyPool: { walker: 20, runner: 25, spitter: 15, brute: 15, screamer: 25 },
    mechanic: "dawn-escape",
  },
];

/** Resolves a Shift's fixed content. Unlike `stageDefFor`, this does NOT
 * wrap — a request past Shift 8 is a caller bug (the campaign has ended by
 * then), so it throws rather than silently replaying Shift 1. */
export function campaignStageDefFor(shift: number): CampaignStageDef {
  const def = CAMPAIGN_STAGES.find((s) => s.shift === shift);
  if (!def) throw new Error(`campaign: no such shift ${shift} (campaign has only ${CAMPAIGN_STAGES.length} shifts)`);
  return def;
}

/** Monotonic wave count across the fixed 8-shift campaign — mirrors
 * stages.ts's `cumulativeWaveIndex` but over `CAMPAIGN_STAGES` directly
 * rather than through the wrapping `stageDefFor`, since Endless's helper
 * would silently sum wrapped Endless content for a shift number instead. */
export function campaignWaveIndex(shift: ShiftId, inStage: number): number {
  let sum = 0;
  for (let s = 1; s < shift; s++) sum += campaignStageDefFor(s).wavesPerStage;
  return sum + inStage;
}

/** Campaign's own difficulty curve — gentle and hand-paced across 8 curated
 * shifts (max ~34 waves total after shorten, not Endless's up-to-40 grind ramp). */
export function campaignDifficultyFor(shift: ShiftId, inStage: number): number {
  return Math.min(15, campaignWaveIndex(shift, inStage) / 2);
}

/* ------------------------------------------------------------------ */
/* Story flags                                                         */
/* ------------------------------------------------------------------ */

export interface CampaignFlags {
  /** Shift 1 cleared with zero shots fired */
  QUIET_S1: boolean;
  /** player finished Diaz in the Shift 4 cottage */
  DIAZ_DOWN: boolean;
  /** DIAZ_DOWN was a melee/quiet finish rather than a gunshot — the doc's two
   * DIAZ_DOWN VO variants ("Discharge in a closed room" vs "I didn't hear a
   * shot") turn on this, and it's also part of the hidden ending's "silent
   * Diaz" requirement. Meaningless when DIAZ_DOWN is false. */
  DIAZ_SILENT: boolean;
  /** Diaz was spared in the Shift 4 cottage and turns later at the fence */
  DIAZ_TURNED: boolean;
  /** Vale died (Shift 3 escort failure, or later) */
  VALE_DEAD: boolean;
  /** Shift 7: dumped the Helminth racks */
  VIAL_DESTROYED: boolean;
  /** Shift 7: lifted one vial instead */
  VIAL_TAKEN: boolean;
  /** stayed under Shift 8's shot budget — true means "stayed dark," a good
   * condition, per the doc's "hidden ending if player stayed dark through 8" */
  SHOT_BUDGET_LOW: boolean;
}

export function defaultCampaignFlags(): CampaignFlags {
  return {
    QUIET_S1: false,
    DIAZ_DOWN: false,
    DIAZ_SILENT: false,
    DIAZ_TURNED: false,
    VALE_DEAD: false,
    VIAL_DESTROYED: false,
    VIAL_TAKEN: false,
    SHOT_BUDGET_LOW: false,
  };
}

/* ------------------------------------------------------------------ */
/* Endings                                                              */
/* ------------------------------------------------------------------ */

export type CampaignEnding =
  | "lights-out"            // VIAL_DESTROYED, Kane lives
  | "second-site"           // VIAL_TAKEN, Vale alive
  | "second-site-vale-dead" // VIAL_TAKEN, Vale dead
  | "woke-the-rows"         // fail / timer / chained screamers
  | "quiet-clockout";       // hidden: silent Diaz, Vale alive, racks destroyed, under shot budget

export const ENDING_COPY: Record<CampaignEnding, { banner: string; sub: string; card: string }> = {
  "lights-out": {
    banner: "LIGHTS OUT",
    sub: "we left it burning",
    card: "THE DEAD DON'T SLEEP. THE PAPERWORK DOES.",
  },
  "second-site": {
    banner: "SECOND SITE",
    sub: "there's always a night hire",
    card: "NIGHT HIRE WANTED. NO QUESTIONS. GRAVEYARD SHIFT.",
  },
  "second-site-vale-dead": {
    banner: "SECOND SITE",
    sub: "you are a fridge now",
    card: "LIVE UNIT IN TRANSIT. HANDLER: NONE.",
  },
  "woke-the-rows": {
    banner: "YOU WOKE THE ROWS",
    sub: "stop transmitting",
    card: "YOU WOKE THE ROWS.",
  },
  "quiet-clockout": {
    banner: "QUIET CLOCK-OUT",
    sub: "punched, 05:12",
    card: "TIME CLOCK — 05:12 — PUNCHED.",
  },
};

/**
 * Resolves Shift 8's ending from story flags.
 *
 * `failed` covers the doc's timer/chained-screamer fail state ("You Woke the
 * Rows") — a gameplay outcome, not a flag combination — so it's checked
 * ahead of every flag-derived branch. The hidden Quiet Clock-out is checked
 * next since its requirements are a strict subset of Second Site's (silent
 * Diaz, Vale alive, racks destroyed, stayed dark) and should win when met.
 */
export function endingFor(flags: CampaignFlags, failed: boolean): CampaignEnding {
  if (failed) return "woke-the-rows";

  const quietDiaz = flags.DIAZ_TURNED || (flags.DIAZ_DOWN && flags.DIAZ_SILENT);
  if (quietDiaz && !flags.VALE_DEAD && flags.VIAL_DESTROYED && flags.SHOT_BUDGET_LOW) {
    return "quiet-clockout";
  }

  if (flags.VIAL_TAKEN) {
    return flags.VALE_DEAD ? "second-site-vale-dead" : "second-site";
  }

  // VIAL_DESTROYED (or neither flag set, which shouldn't happen post-Shift-7
  // but Lights Out is the safer default than throwing on a malformed save)
  return "lights-out";
}
