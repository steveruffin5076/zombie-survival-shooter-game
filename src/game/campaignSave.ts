import { defaultCampaignFlags, type CampaignFlags, type ShiftId } from "./campaign";

export const CAMPAIGN_SAVE_VERSION = 1;

/** Story Campaign's run checkpoint — separate from Endless's `SaveData`
 * (save.ts) per design: the two modes can't be "in progress" as the same
 * save, and campaign progress is narrative (shift + flags), not loot/loadout
 * state, so the shapes don't overlap. Written at every shift clear, restored
 * on death to the last checkpoint's shift-start; wiped on a true game over. */
export interface CampaignSaveData {
  version: number;
  shift: ShiftId;
  flags: CampaignFlags;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  /** shots fired so far in the current shift — Shift 1's QUIET_S1 and Shift
   * 8's SHOT_BUDGET_LOW both read a live version of this from the engine,
   * but it's saved too so a mid-shift reload doesn't reset the count. */
  shotsThisShift: number;
}

const CAMPAIGN_SAVE_KEY = "graveyard-shift-campaign-save";

export function defaultCampaignSave(): CampaignSaveData {
  return {
    version: CAMPAIGN_SAVE_VERSION,
    shift: 1,
    flags: defaultCampaignFlags(),
    level: 1,
    xp: 0,
    xpNext: 12,
    hp: 100,
    shotsThisShift: 0,
  };
}

function migrateCampaignSave(raw: unknown): CampaignSaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<CampaignSaveData>;
  if (typeof d.version !== "number" || d.version > CAMPAIGN_SAVE_VERSION) return null;
  if (typeof d.shift !== "number" || d.shift < 1 || d.shift > 8) return null;
  const base = defaultCampaignSave();
  return {
    version: CAMPAIGN_SAVE_VERSION,
    shift: d.shift as ShiftId,
    flags: { ...base.flags, ...d.flags },
    level: d.level ?? base.level,
    xp: d.xp ?? base.xp,
    xpNext: d.xpNext ?? base.xpNext,
    hp: d.hp ?? base.hp,
    shotsThisShift: d.shotsThisShift ?? base.shotsThisShift,
  };
}

export function saveCampaign(data: CampaignSaveData): void {
  try {
    localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage full/unavailable — a lost checkpoint isn't worth crashing the run over
  }
}

export function loadCampaign(): CampaignSaveData | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_SAVE_KEY);
    if (!raw) return null;
    return migrateCampaignSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearCampaign(): void {
  try {
    localStorage.removeItem(CAMPAIGN_SAVE_KEY);
  } catch {
    // nothing to do — no save, no problem
  }
}
