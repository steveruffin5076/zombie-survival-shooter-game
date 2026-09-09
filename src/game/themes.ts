/**
 * Per-stage visual identity. `render()` doesn't consume these yet — that's
 * Phase 2 ("per-stage themes in render() + 3 new decor primitives"). For now
 * this just gives `stages.ts` a themeId to point at and `Engine` a stable
 * place to hold "which theme is active" across stage transitions.
 */
export interface ThemeDef {
  id: string;
  accent: string;
}

export const THEMES: Record<string, ThemeDef> = {
  cemetery: { id: "cemetery", accent: "#4a7c52" },
  suburbs: { id: "suburbs", accent: "#8a6d3a" },
  highway: { id: "highway", accent: "#6b7280" },
  arena: { id: "arena", accent: "#b91c1c" },
};
