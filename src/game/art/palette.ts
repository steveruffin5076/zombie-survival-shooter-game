/**
 * Material color ramps for pixel-art sprites.
 *
 * Deliberately separate from `themes.ts`: THEMES owns per-STAGE identity
 * (ground gradients, accent, decor weighting) and keeps doing so. This file
 * owns per-MATERIAL shading — the 3-4 step ramps a sprite needs to read as a
 * solid object under a single overhead light.
 *
 * Values continue the palette already on screen (the player's teal rig, the
 * SKIN/CLOTH arrays in engine.ts) rather than starting a new one, so the
 * pixel sprites don't clash with the effects still drawn as vectors.
 */

/** Light -> dark, 4 steps. Index 0 is the lit top, index 3 the shadow side. */
export type Ramp = readonly [string, string, string, string];

export const RAMPS = {
  /** Player fatigues — the existing #0e7490/#0a3542 teal rig. */
  playerSuit: ["#1596b4", "#0e7490", "#0b5567", "#083845"],
  /** Player vest/webbing, a shade off the suit so gear reads separately. */
  playerRig: ["#12627a", "#0c4a5e", "#093846", "#062832"],
  /** Combat helmet — dark olive so it doesn't outshout the body at 24x24. */
  playerHelmet: ["#5c6b4e", "#44503a", "#2f382a", "#1d231a"],
  /** Squad marking. The one saturated accent, so the player reads instantly. */
  playerMark: ["#dc2626", "#a82626", "#7f1d1d", "#5b1414"],
  /** Visor glow — the player's signature cue for which way they face. */
  visor: ["#67e8f9", "#22d3ee", "#0e7490", "#083845"],
  /** Bare skin — face sliver, hands. */
  skin: ["#f0c9a4", "#e8b892", "#c2906c", "#8f6748"],

  /** Rotted zombie flesh, from the SKIN array in engine.ts. */
  rot: ["#a8bb90", "#8ba067", "#6d8560", "#4c6042"],
  /** A sicklier variant, for spitters. */
  rotSick: ["#8fb862", "#6b9146", "#4a6b3a", "#324a26"],
  /** Runner flesh — browner, drier. */
  rotDry: ["#c4885a", "#a06a44", "#7a4e30", "#523320"],
  /** Brute hide — heavy, leathery. */
  rotHeavy: ["#9c8265", "#7a6450", "#5a4a3a", "#3c3128"],
  /** Screamer — bruised purple.*/
  rotPale: ["#b3a3c4", "#9384a3", "#6f6080", "#4a4058"],

  /** Torn clothing, from the CLOTH array in engine.ts. */
  rags: ["#55627d", "#3e4a62", "#2b3444", "#1b212c"],
  ragsWarm: ["#6b5359", "#4e3c42", "#372a2f", "#231a1d"],

  /** Gunmetal and dark plastics. */
  steel: ["#3e4a5a", "#28323f", "#1a212b", "#111a26"],
  /** Weathered metal for wrecks and barriers. */
  rust: ["#9c5a33", "#7a4526", "#57311b", "#3a2012"],
  /** Bare concrete — ground tiles, barriers. */
  concrete: ["#5a6068", "#464b52", "#33373d", "#232629"],
  /** Asphalt roadway. */
  asphalt: ["#3a3d42", "#2c2f33", "#212326", "#17191b"],
  /** Bone/gravestone. */
  bone: ["#b5b0a2", "#94907f", "#6d6a5c", "#4a4840"],

  /** Wet blood, from the BLOOD array in engine.ts. */
  blood: ["#b91c1c", "#991b1b", "#7f1d1d", "#5f1118"],
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof RAMPS;

/** The near-black every sprite is outlined in, so bodies pop off dark ground. */
export const OUTLINE = "#05070b";

/** Claw/tooth highlight — a few near-white pixels read as menace at this size. */
export const CLAW = "#e6e6e1";

/** Glowing eyes. Kept bright: at 24x24 this is the clearest "it sees you" cue. */
export const EYE_HOSTILE = "#dc2626";
export const EYE_ALERT = "#f59e0b";

/**
 * Per-zombie-type ramp assignment. Keys match engine.ts's `ZType` union
 * exactly — walker / runner / brute / spitter / screamer. Silhouette does most
 * of the work of telling them apart, but color carries it at a glance in a
 * crowd, which flat single-tone bodies never managed.
 */
export const ZOMBIE_RAMPS: Record<string, { flesh: Ramp; cloth: Ramp }> = {
  walker: { flesh: RAMPS.rot, cloth: RAMPS.rags },
  runner: { flesh: RAMPS.rotDry, cloth: RAMPS.ragsWarm },
  brute: { flesh: RAMPS.rotHeavy, cloth: RAMPS.ragsWarm },
  spitter: { flesh: RAMPS.rotSick, cloth: RAMPS.rags },
  screamer: { flesh: RAMPS.rotPale, cloth: RAMPS.rags },
};
