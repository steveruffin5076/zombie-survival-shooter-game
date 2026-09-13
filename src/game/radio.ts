/**
 * Radio script for the Story Campaign, transcribed from the Quarantine
 * Protocol campaign bible. Lines render as speaker-colored subtitle text
 * (see engine.ts's `radio` queue) — the project has no audio-asset pipeline
 * (src/game/sfx.ts is 100% procedural WebAudio), so there is no spoken VO,
 * only a short procedural "radio chirp" cue per line plus this text.
 *
 * Cues are keyed by shift + trigger, matching the doc's "cues in play order"
 * structure. `condition` gates a line on the current flag state where the
 * doc branches on one (e.g. Vale alive vs dead) — engine.ts picks the first
 * matching entry for a trigger and ignores the rest.
 */
import type { CampaignFlags, ShiftId } from "./campaign";

export type Speaker = "RHEE" | "VALE" | "DIAZ" | "UNK" | "CREW";

export type RadioTrigger =
  | "enter" | "first-paint" | "first-shot" | "quiet-tag" | "objective" | "shift-clear"
  | "runner-close" | "lane-redirect" | "crank-hold" | "meet-diaz"
  | "lantern-on" | "lantern-off" | "escort-start" | "escort-spit" | "escort-fail" | "escort-success"
  | "wall-break" | "choice-prompt" | "choice-gunshot" | "choice-silent" | "choice-spare"
  | "decoy-seen" | "decoy-painted" | "decoy-passed" | "canister-pickup"
  | "stray-traffic" | "badge-wall" | "vault-door-brute"
  | "vault-enter" | "vault-terminal-solo" | "rack-prompt" | "vault-destroyed" | "vault-taken" | "cell-mercy"
  | "dawn-enter" | "dawn-vial-taken" | "dawn-vial-destroyed" | "dawn-gate-brute" | "dawn-near-fail";

export interface RadioCue {
  shift: ShiftId;
  trigger: RadioTrigger;
  speaker: Speaker;
  text: string;
  /** picks this cue over others on the same trigger when true; first match wins */
  condition?: (flags: CampaignFlags) => boolean;
}

const aliveVale = (f: CampaignFlags) => !f.VALE_DEAD;
const deadVale = (f: CampaignFlags) => f.VALE_DEAD;

export const RADIO_SCRIPT: RadioCue[] = [
  // ---- Shift 1 — Front Rows ----
  { shift: 1, trigger: "enter", speaker: "RHEE", text: "Contractor Kane. Wall clock has you on." },
  { shift: 1, trigger: "enter", speaker: "RHEE", text: "Front rows only. Confirm contained. Keep the light off the markers." },
  { shift: 1, trigger: "enter", speaker: "RHEE", text: "They do not see in the dark. Your sight is the exception. Do not paint anything you do not intend to finish." },
  { shift: 1, trigger: "first-paint", speaker: "RHEE", text: "That's a lock. You showed it the beam. It's coming." },
  { shift: 1, trigger: "first-shot", speaker: "RHEE", text: "Discharge logged. You just told the whole row where the living one is." },
  { shift: 1, trigger: "quiet-tag", speaker: "VALE", text: "Whoever is on the grounds — thank you for not lighting the stones. I'm in the chapel. I have names that don't match the plots." },
  { shift: 1, trigger: "objective", speaker: "RHEE", text: "Shed is a hold point. Clock the shift. Do not get comfortable." },
  { shift: 1, trigger: "objective", speaker: "VALE", text: "Don't shoot the chapel door when you come. I have a list. I need you to see it." },

  // ---- Shift 2 — Service Road ----
  { shift: 2, trigger: "enter", speaker: "DIAZ", text: "Gatehouse. Diaz. I stayed late. Don't give me a speech." },
  { shift: 2, trigger: "enter", speaker: "DIAZ", text: "Something moved in the trees on your right. If you pop one, the left side starts running. I'm not kidding." },
  { shift: 2, trigger: "enter", speaker: "RHEE", text: "Inner gate is your mark. Hands on the crank means the carbine is down. Plan for that." },
  { shift: 2, trigger: "runner-close", speaker: "DIAZ", text: "Yeah. That's the fast one. Don't admire it." },
  { shift: 2, trigger: "lane-redirect", speaker: "RHEE", text: "Both lanes heard that. You do not get to shoot one path clean." },
  { shift: 2, trigger: "crank-hold", speaker: "DIAZ", text: "I'm coming to you. Sleeve's torn. It was a branch. It was a branch." },
  { shift: 2, trigger: "meet-diaz", speaker: "DIAZ", text: "Don't look at it. Gate's open. Chapel next. I'll walk as far as I walk.", condition: (f) => !f.QUIET_S1 },
  { shift: 2, trigger: "meet-diaz", speaker: "VALE", text: "Diaz is bleeding like a bite, not a branch. He won't say it. You don't have to either. Just get to me.", condition: (f) => f.QUIET_S1 },
  { shift: 2, trigger: "shift-clear", speaker: "RHEE", text: "Inner gate logged. Civilian in the chapel is not your problem unless she lights something." },

  // ---- Shift 3 — Chapel Grounds ----
  { shift: 3, trigger: "enter", speaker: "VALE", text: "I lit the aisle. I know. I need the plaques." },
  { shift: 3, trigger: "enter", speaker: "RHEE", text: "Who lit that building." },
  { shift: 3, trigger: "enter", speaker: "VALE", text: "I did. Come down the center or take the colonnade. The spitters own the light, Kane. They won't close if they can paint you." },
  { shift: 3, trigger: "lantern-off", speaker: "RHEE", text: "Better." },
  { shift: 3, trigger: "lantern-off", speaker: "VALE", text: "I can't read in this. Point your sight at the floor stones when I say. Not at the pews. Not at her if she's standing still — wait. That's not— never mind. Just come." },
  { shift: 3, trigger: "lantern-on", speaker: "RHEE", text: "You are feeding the range-hogs. Kill the light or accept the acid." },
  { shift: 3, trigger: "escort-start", speaker: "VALE", text: "Ossuary office. Short walk. If I drop the ledger, pick it up. The dates are the whole argument." },
  { shift: 3, trigger: "escort-spit", speaker: "VALE", text: "They're kiting. Don't chase the spit. Chase the door." },
  { shift: 3, trigger: "escort-fail", speaker: "RHEE", text: "Civilian is down. Leave her. The ledger if you can see it. Then annex." },
  { shift: 3, trigger: "escort-fail", speaker: "RHEE", text: "Do not narrate it." },
  { shift: 3, trigger: "escort-success", speaker: "VALE", text: "Look. Mass plots. Seventeen days before the city admitted anything. Stamp is Q-PROT. They didn't bury victims. They buried inventory." },
  { shift: 3, trigger: "escort-success", speaker: "RHEE", text: "That ledger is not in your scope. Move to the annex." },
  { shift: 3, trigger: "escort-success", speaker: "VALE", text: "My scope is the date, Captain." },

  // ---- Shift 4 — Old Annex ----
  { shift: 4, trigger: "enter", speaker: "DIAZ", text: "I can still walk. Greenhouse or cottages. I don't care. Don't look at the sleeve." },
  { shift: 4, trigger: "enter", speaker: "RHEE", text: "Annex is old worker housing. If something large is in there it will not stay in one lane. Expect the wall to fail." },
  { shift: 4, trigger: "wall-break", speaker: "DIAZ", text: "That's not a walker." },
  { shift: 4, trigger: "wall-break", speaker: "RHEE", text: "Heavy. Slam will throw you into the path you didn't pick. Do not stand on the seam." },
  { shift: 4, trigger: "choice-prompt", speaker: "DIAZ", text: "Okay. Okay. It's not a branch." },
  { shift: 4, trigger: "choice-prompt", speaker: "DIAZ", text: "If you do it, do it in here. Quiet as you can. If you don't, I'm going to start running at the wrong things and I won't know why." },
  { shift: 4, trigger: "choice-gunshot", speaker: "RHEE", text: "Discharge in a closed room. You woke whoever was sleeping on both sides." },
  { shift: 4, trigger: "choice-gunshot", speaker: "VALE", text: "You didn't let it finish. I heard. I'm sorry I asked you to be a better person than the shift.", condition: aliveVale },
  { shift: 4, trigger: "choice-silent", speaker: "VALE", text: "I didn't hear a shot. Thank you — that's a disgusting thing to thank someone for. Move.", condition: aliveVale },
  { shift: 4, trigger: "choice-silent", speaker: "RHEE", text: "Annex is clear enough. Hollow gate." },
  { shift: 4, trigger: "choice-spare", speaker: "DIAZ", text: "I can still— I can— left. No. Your left." },
  { shift: 4, trigger: "choice-spare", speaker: "DIAZ", text: "Don't let me get to the gate like this." },
  { shift: 4, trigger: "choice-spare", speaker: "RHEE", text: "Finish it. Then Helminth-09. Soil sample. Do not open anything that is not soil." },
  { shift: 4, trigger: "shift-clear", speaker: "RHEE", text: "New tasking. Plot Helminth-09. Canister. Night store." },
  { shift: 4, trigger: "shift-clear", speaker: "VALE", text: "There is no soil in that plot.", condition: aliveVale },

  // ---- Shift 5 — The Hollow (title stage) ----
  { shift: 5, trigger: "enter", speaker: "RHEE", text: "Hollow. Two rows. Third stone on the right. Helminth-09." },
  { shift: 5, trigger: "enter", speaker: "RHEE", text: "Keep the beam off the center. If you see a woman standing still between the lanes, you did not find a survivor." },
  { shift: 5, trigger: "decoy-seen", speaker: "VALE", text: "Kane — there is a woman in the rows. She isn't moving. I think she's—", condition: aliveVale },
  { shift: 5, trigger: "decoy-seen", speaker: "RHEE", text: "She is not." },
  { shift: 5, trigger: "decoy-painted", speaker: "RHEE", text: "You painted her. That sound is not grief. That is a call. Both lanes. Behind you as well." },
  { shift: 5, trigger: "decoy-passed", speaker: "VALE", text: "You didn't touch her with the light. Good. I hate that that's the standard now.", condition: aliveVale },
  { shift: 5, trigger: "canister-pickup", speaker: "RHEE", text: "You have it. Do not open it. Do not hand it to Vale. Stack next." },
  { shift: 5, trigger: "canister-pickup", speaker: "VALE", text: "Stencil says LIVE. That is a refrigerator with a headstone, Captain.", condition: aliveVale },
  { shift: 5, trigger: "canister-pickup", speaker: "RHEE", text: "It is a sample. Walk." },

  // ---- Shift 6 — Mausoleum Stack ----
  { shift: 6, trigger: "stray-traffic", speaker: "UNK", text: "Night contractor still on site. Sample is mobile. Sanitize after recovery." },
  { shift: 6, trigger: "stray-traffic", speaker: "RHEE", text: "Ignore stray traffic." },
  { shift: 6, trigger: "stray-traffic", speaker: "VALE", text: "That was not stray. That was a cleaner voice than yours.", condition: aliveVale },
  { shift: 6, trigger: "enter", speaker: "RHEE", text: "Spitters take the gallery. Crypt is darker and slower. Do not linger under glass." },
  { shift: 6, trigger: "badge-wall", speaker: "VALE", text: "Stop. That's your face. Night security. Trial site. Helminth.", condition: aliveVale },
  { shift: 6, trigger: "badge-wall", speaker: "VALE", text: "They didn't insert you, Kane. They scheduled you. Night hires don't get recovered in the report.", condition: aliveVale },
  { shift: 6, trigger: "badge-wall", speaker: "RHEE", text: "Keep moving." },
  { shift: 6, trigger: "vault-door-brute", speaker: "RHEE", text: "If it hits the door it opens. If it hits you, you change lanes whether you wanted to or not." },
  { shift: 6, trigger: "shift-clear", speaker: "RHEE", text: "Dawn sanitation is locked on a clock. You do not want to be visible when it starts." },
  { shift: 6, trigger: "shift-clear", speaker: "VALE", text: "Visible means the laser. Visible means a shot. Visible means staying.", condition: aliveVale },
  { shift: 6, trigger: "shift-clear", speaker: "RHEE", text: "Vault. Then gate. That is the whole remaining night." },

  // ---- Shift 7 — Vault Helminth ----
  { shift: 7, trigger: "vault-enter", speaker: "VALE", text: "Glass left. Pipes right. Faces behind the glass will lock if you paint them. Some of them can still scream through it.", condition: aliveVale },
  { shift: 7, trigger: "vault-enter", speaker: "RHEE", text: "Recover or deny. Those are the only two verbs I have for you." },
  { shift: 7, trigger: "vault-terminal-solo", speaker: "RHEE", text: "Terminal still works without her. Destroy the racks or take one unit. I will not advise you which makes you sleep.", condition: deadVale },
  { shift: 7, trigger: "rack-prompt", speaker: "VALE", text: "If we dump the racks there is no second site. If we lift one vial there is a chance — and they will hunt us to the gate.", condition: aliveVale },
  { shift: 7, trigger: "rack-prompt", speaker: "RHEE", text: "Leave it in the dark and walk. You were never meant to leave with it." },
  { shift: 7, trigger: "vault-destroyed", speaker: "VALE", text: "Okay. Okay. No second fridge.", condition: aliveVale },
  { shift: 7, trigger: "vault-destroyed", speaker: "RHEE", text: "Alarm is theirs. You just made the rest of the night louder. Gate anyway." },
  { shift: 7, trigger: "vault-taken", speaker: "VALE", text: "I have it. Don't point the sight at the case. It's wet.", condition: aliveVale },
  { shift: 7, trigger: "vault-taken", speaker: "RHEE", text: "Tracker will ping. Cleanup will be standing on your gate. Their lamps do what your laser does." },
  { shift: 7, trigger: "vault-taken", speaker: "UNK", text: "Live unit is moving. Contractor is not compliant. Meet at service gate." },
  { shift: 7, trigger: "cell-mercy", speaker: "VALE", text: "You don't have to. They already logged these as failed stores. But I saw you stop the beam. I won't forget that.", condition: aliveVale },

  // ---- Shift 8 — Dawn Gate ----
  { shift: 8, trigger: "enter", speaker: "RHEE", text: "Approach is two lanes to the service gate. Sanitation light is coming down the grounds. If it reaches you, you are part of the row." },
  { shift: 8, trigger: "enter", speaker: "RHEE", text: "Two screamers staggered. If you chain them you will not see the gate." },
  { shift: 8, trigger: "dawn-vial-taken", speaker: "CREW", text: "Lamps on. Contractor in the rows. Recover the unit. Leave the hire." },
  { shift: 8, trigger: "dawn-vial-taken", speaker: "VALE", text: "Their light is going to turn everything toward the gate. Including us.", condition: aliveVale },
  { shift: 8, trigger: "dawn-vial-taken", speaker: "RHEE", text: "I told you not to carry it." },
  { shift: 8, trigger: "dawn-vial-destroyed", speaker: "RHEE", text: "You come out empty I can still file this as contained. Do not get sentimental on the last hundred meters." },
  { shift: 8, trigger: "dawn-vial-destroyed", speaker: "VALE", text: "Contained means they do this again tomorrow night in a different cemetery.", condition: aliveVale },
  { shift: 8, trigger: "dawn-gate-brute", speaker: "RHEE", text: "Heavy on the bar. If it throws you back you land in the light. Finish it and clock out." },
  { shift: 8, trigger: "dawn-near-fail", speaker: "RHEE", text: "You woke the rows. I can hear it from the wall." },
];

/** First cue matching this shift + trigger + current flags, if any. */
export function radioFor(shift: ShiftId, trigger: RadioTrigger, flags: CampaignFlags): RadioCue | null {
  for (const cue of RADIO_SCRIPT) {
    if (cue.shift !== shift || cue.trigger !== trigger) continue;
    if (cue.condition && !cue.condition(flags)) continue;
    return cue;
  }
  return null;
}

/** ALL cues matching this shift + trigger + current flags, in script order —
 * several triggers (e.g. Shift 1's "enter") fire a short back-to-back run of
 * lines rather than one, so callers queue the whole list. */
export function radioSequenceFor(shift: ShiftId, trigger: RadioTrigger, flags: CampaignFlags): RadioCue[] {
  return RADIO_SCRIPT.filter(
    (cue) => cue.shift === shift && cue.trigger === trigger && (!cue.condition || cue.condition(flags))
  );
}
