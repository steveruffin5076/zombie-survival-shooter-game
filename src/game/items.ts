import type { ItemShape } from "./grid";
import type { WeaponClass } from "./weapons";
import type { Rarity } from "./types";

export type ItemKind = "ammo" | "consumable";
/** The three consumable hotkeys — Grenade / Bandage / Tactical stim. */
export type ConsumableKey = "G" | "B" | "T";

export interface ItemDef extends ItemShape {
  id: string;
  name: string;
  short: string;
  kind: ItemKind;
  rarity: Rarity;
  icon: string;
  desc: string;
  /** ammo items only — which weapon class's reserve this refills */
  ammoClass?: WeaponClass;
  /** ammo items only — reserve rounds granted */
  ammoAmount?: number;
  /** consumable items only — hotkey used to consume one from the backpack */
  hotkey?: ConsumableKey;
}

export const ITEMS: Record<string, ItemDef> = {
  // no ammo_pistol — every pistol has unlimited reserve by design (see
  // weapons.ts's "PISTOLS — unlimited reserve" section), so a pistol ammo
  // box could never actually be used; it used to drop from crates anyway
  // and just sat dead in the backpack.
  ammo_smg: {
    id: "ammo_smg", name: "SMG Ammo Box", short: "SMG BOX", kind: "ammo", rarity: "common",
    icon: "Wind", w: 1, h: 1, ammoClass: "smg", ammoAmount: 60,
    desc: "60 rounds for SMGs. Auto-loads when one runs dry.",
  },
  ammo_shotgun: {
    id: "ammo_shotgun", name: "Shotgun Shells", short: "SHELLS", kind: "ammo", rarity: "rare",
    icon: "Target", w: 1, h: 2, ammoClass: "shotgun", ammoAmount: 16,
    desc: "16 shells. Auto-loads when a shotgun runs dry.",
  },
  ammo_carbine: {
    id: "ammo_carbine", name: "Carbine Mag Box", short: "RIFLE BOX", kind: "ammo", rarity: "rare",
    icon: "Layers", w: 2, h: 1, ammoClass: "carbine", ammoAmount: 60,
    desc: "60 rounds for carbines. Auto-loads when one runs dry.",
  },
  bandage: {
    id: "bandage", name: "Field Bandage", short: "BANDAGE", kind: "consumable", rarity: "common",
    icon: "HeartPulse", w: 1, h: 1, hotkey: "B",
    desc: "Instantly restores 40% max HP.",
  },
  grenade: {
    id: "grenade", name: "Frag Grenade", short: "GRENADE", kind: "consumable", rarity: "rare",
    icon: "Activity", w: 1, h: 1, hotkey: "G",
    desc: "Thrown explosive — heavy damage in a small radius.",
  },
  stim: {
    id: "stim", name: "Tactical Stim", short: "STIM", kind: "consumable", rarity: "epic",
    icon: "Zap", w: 1, h: 1, hotkey: "T",
    desc: "6s rush: faster hands, faster feet.",
  },
};

export const ITEM_IDS = Object.keys(ITEMS);
export const shapeOfItem = (itemId: string): ItemShape => ITEMS[itemId] ?? { w: 1, h: 1 };
export const AMMO_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].kind === "ammo");
export const CONSUMABLE_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].kind === "consumable");
export const itemForHotkey = (key: ConsumableKey): ItemDef | undefined =>
  CONSUMABLE_ITEMS.map((id) => ITEMS[id]).find((it) => it.hotkey === key);
