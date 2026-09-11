/** Display/audio prefs — separate from save.ts's run/profile saves since these
 * are pure client prefs with no gameplay meaning, persisted independently. */
export interface GameSettings {
  /** 0..1, maps directly to the SFX master gain */
  volume: number;
  /** CSS filter: brightness() multiplier on the canvas only, so HUD text
   * stays legible regardless of setting — 0.5..1.5, 1 = unchanged */
  brightness: number;
  /** world magnification, 1..1.5, 1 = unchanged. Applied by the engine to the
   * canvas only; the HUD has its own scaling and is unaffected. */
  zoom: number;
}

const KEY = "graveyard-shift-settings";
const DEFAULTS: GameSettings = { volume: 0.45, brightness: 1, zoom: 1 };

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      volume: clamp01(typeof parsed.volume === "number" ? parsed.volume : DEFAULTS.volume),
      brightness: clampBrightness(typeof parsed.brightness === "number" ? parsed.brightness : DEFAULTS.brightness),
      zoom: clampZoom(typeof parsed.zoom === "number" ? parsed.zoom : DEFAULTS.zoom),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: GameSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable (private mode, quota) — settings just won't persist
  }
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function clampBrightness(v: number) {
  return Math.max(0.5, Math.min(1.5, v));
}
function clampZoom(v: number) {
  return Math.max(1, Math.min(1.5, v));
}
