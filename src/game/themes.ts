/** Per-stage visual identity, consumed by `Engine.render()`'s sky/ground gradients and `drawDecor()`'s kind weighting. */
export interface ThemeDef {
  id: string;
  /** accent color used for stage-specific UI/FX */
  accent: string;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  skyBottom: string;
  groundTop: string;
  groundMid: string;
  groundDeep: string;
  /** decor kind weights: [tombstoneA, tombstoneB, tree, lamp, car, barrier, rubble] */
  decorWeights: [number, number, number, number, number, number, number];
}

export const THEMES: Record<string, ThemeDef> = {
  cemetery: {
    id: "cemetery", accent: "#4a7c52",
    skyTop: "#03050c", skyMid: "#0a1122", skyHorizon: "#231a33", skyBottom: "#0a0d16",
    groundTop: "#131a14", groundMid: "#0d120e", groundDeep: "#04060a",
    decorWeights: [4, 3, 3, 1, 0, 0, 0],
  },
  suburbs: {
    id: "suburbs", accent: "#8a6d3a",
    skyTop: "#0a0705", skyMid: "#1a130d", skyHorizon: "#332015", skyBottom: "#0d0906",
    groundTop: "#1a150f", groundMid: "#120e0a", groundDeep: "#060402",
    // Act I's "foliage-heavy neighborhood streets" per enhancement-1.md —
    // tree weight bumped from 2 to 4, everything else unchanged
    decorWeights: [1, 1, 4, 1, 3, 0, 2],
  },
  highway: {
    id: "highway", accent: "#6b7280",
    skyTop: "#050608", skyMid: "#0d1116", skyHorizon: "#1c2733", skyBottom: "#080a0d",
    groundTop: "#15181c", groundMid: "#0e1013", groundDeep: "#050607",
    decorWeights: [0, 0, 1, 1, 3, 4, 1],
  },
  arena: {
    id: "arena", accent: "#b91c1c",
    skyTop: "#0a0303", skyMid: "#1a0808", skyHorizon: "#3a1414", skyBottom: "#0d0404",
    groundTop: "#1a0f0d", groundMid: "#120a09", groundDeep: "#060302",
    decorWeights: [0, 0, 0, 1, 1, 2, 4],
  },
};
