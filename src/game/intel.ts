/**
 * Intel documents — the "Outside World News" puzzle pieces from `enhancement-1.md`.
 * Pure data, no engine coupling. One guaranteed document per exploration stage
 * (`indexInAct` 0/1/2 maps directly to `slot`); the Terminal Defense stage has none.
 */

export type DocKind = "newspaper" | "dossier" | "diary";

export interface DocDef {
  id: string;
  actId: number;
  /** which exploration stage this was found in — matches StageDef.indexInAct */
  slot: 0 | 1 | 2;
  kind: DocKind;
  masthead: string;
  headline: string;
  dateline: string;
  body: string[];
}

export const INTEL_DOCS: Record<string, DocDef> = {
  act1_doc0: {
    id: "act1_doc0", actId: 1, slot: 0, kind: "newspaper",
    masthead: "THE METRO CHRONICLE",
    headline: "“REDSHIFT” GRID FAULT BLAMED FOR CITYWIDE BLACKOUTS",
    dateline: "Day 3 After Redshift — Final Print Edition",
    body: [
      "Aetheris Dynamics spokespeople insist the crimson glow reported across three counties is a “cosmetic recalibration” of the Horizon Frequency network, not a malfunction.",
      "Hospitals report an unprecedented spike in violent psychiatric admissions among residents caught outdoors during the color shift. Aetheris has not responded to requests for the admissions data.",
      "“Lighting Tomorrow, Today” banners still hang outside city hall. Nobody has taken them down.",
    ],
  },
  act1_doc1: {
    id: "act1_doc1", actId: 1, slot: 1, kind: "dossier",
    masthead: "TOWN COUNCIL — CLOSED SESSION MINUTES",
    headline: "MOTION TO DELAY GRID SHUTDOWN: APPROVED 5–2",
    dateline: "Day 1 After Redshift — Not For Public Release",
    body: [
      "Councilman Ortiz moved to request emergency shutdown of the Horizon Frequency towers pending safety review. Motion opposed by Aetheris counsel, citing the exclusivity clause in the township's 20-year infrastructure contract.",
      "Vote recorded 5–2 against shutdown. Council adjourned early; several members did not return calls afterward.",
      "Margin note, different handwriting: “they knew. we all knew. wrote this down so someone would.”",
    ],
  },
  act1_doc2: {
    id: "act1_doc2", actId: 1, slot: 2, kind: "diary",
    masthead: "FOUND NOTEBOOK — WATER-DAMAGED",
    headline: "no title",
    dateline: "undated, presumed Day 88–89",
    body: [
      "Sheriff's been walking the block every night since it happened. Still in his gear. Still thinks he's protecting something.",
      "Tried waving at him from the Petrov's porch. He didn't wave back. He doesn't do anything back anymore.",
      "If you're reading this and you see him first — don't run. Running is what gets their attention.",
    ],
  },
};

export function docsForAct(actId: number): DocDef[] {
  return Object.values(INTEL_DOCS)
    .filter((d) => d.actId === actId)
    .sort((a, b) => a.slot - b.slot);
}

/** The document a given exploration stage awards, or null if that act has none authored yet. */
export function docIdFor(actId: number, slot: 0 | 1 | 2): string | null {
  return docsForAct(actId).find((d) => d.slot === slot)?.id ?? null;
}
