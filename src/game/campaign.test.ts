import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_STAGES, campaignStageDefFor, defaultCampaignFlags, endingFor,
  type CampaignFlags,
} from "./campaign";
import { RADIO_SCRIPT, radioFor, radioSequenceFor } from "./radio";

describe("Campaign stages", () => {
  it("has exactly 8 shifts", () => {
    expect(CAMPAIGN_STAGES).toHaveLength(8);
  });

  it("shifts are uniquely numbered 1-8 in order", () => {
    expect(CAMPAIGN_STAGES.map((s) => s.shift)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("every shift has a non-empty enemy pool", () => {
    for (const s of CAMPAIGN_STAGES) {
      const total = Object.values(s.enemyPool).reduce((sum: number, w) => sum + (w ?? 0), 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("campaignStageDefFor resolves each shift and does not wrap past 8", () => {
    for (let i = 1; i <= 8; i++) {
      expect(campaignStageDefFor(i).shift).toBe(i);
    }
    expect(() => campaignStageDefFor(9)).toThrow();
    expect(() => campaignStageDefFor(0)).toThrow();
  });

  it("Shift 5 is the title stage", () => {
    expect(campaignStageDefFor(5).titleStage).toBe(true);
  });
});

describe("Campaign endings", () => {
  const flags = (over: Partial<CampaignFlags>): CampaignFlags => ({ ...defaultCampaignFlags(), ...over });

  it("a timer/screamer failure always resolves to Woke the Rows", () => {
    expect(endingFor(flags({ VIAL_TAKEN: true }), true)).toBe("woke-the-rows");
    expect(endingFor(flags({ VIAL_DESTROYED: true }), true)).toBe("woke-the-rows");
  });

  it("VIAL_DESTROYED with Kane alive resolves to Lights Out", () => {
    expect(endingFor(flags({ VIAL_DESTROYED: true }), false)).toBe("lights-out");
  });

  it("VIAL_TAKEN with Vale alive resolves to Second Site", () => {
    expect(endingFor(flags({ VIAL_TAKEN: true }), false)).toBe("second-site");
  });

  it("VIAL_TAKEN with Vale dead resolves to Second Site, Vale dead", () => {
    expect(endingFor(flags({ VIAL_TAKEN: true, VALE_DEAD: true }), false)).toBe("second-site-vale-dead");
  });

  it("the hidden Quiet Clock-out requires silent Diaz, Vale alive, racks destroyed, and staying under budget", () => {
    const full = flags({
      DIAZ_TURNED: true, VALE_DEAD: false, VIAL_DESTROYED: true, SHOT_BUDGET_LOW: true,
    });
    expect(endingFor(full, false)).toBe("quiet-clockout");

    // silent via a quiet finish (not just sparing him) also qualifies
    const silentFinish = flags({
      DIAZ_DOWN: true, DIAZ_SILENT: true, VALE_DEAD: false, VIAL_DESTROYED: true, SHOT_BUDGET_LOW: true,
    });
    expect(endingFor(silentFinish, false)).toBe("quiet-clockout");
  });

  it("missing any Quiet Clock-out requirement falls back to Lights Out/Second Site", () => {
    // Diaz finished with a gunshot (not silent) disqualifies it even though everything else matches
    const loudDiaz = flags({
      DIAZ_DOWN: true, DIAZ_SILENT: false, VALE_DEAD: false, VIAL_DESTROYED: true, SHOT_BUDGET_LOW: true,
    });
    expect(endingFor(loudDiaz, false)).toBe("lights-out");

    // over shot budget disqualifies it
    const noisyRun = flags({
      DIAZ_TURNED: true, VALE_DEAD: false, VIAL_DESTROYED: true, SHOT_BUDGET_LOW: false,
    });
    expect(endingFor(noisyRun, false)).toBe("lights-out");
  });
});

describe("Radio script", () => {
  it("every cue references a valid shift 1-8", () => {
    for (const cue of RADIO_SCRIPT) {
      expect(cue.shift).toBeGreaterThanOrEqual(1);
      expect(cue.shift).toBeLessThanOrEqual(8);
    }
  });

  it("every cue has a non-empty speaker and text", () => {
    for (const cue of RADIO_SCRIPT) {
      expect(cue.speaker.length).toBeGreaterThan(0);
      expect(cue.text.length).toBeGreaterThan(0);
    }
  });

  it("radioFor returns the first matching cue and respects conditions", () => {
    const quiet = defaultCampaignFlags();
    const notQuiet = { ...quiet, QUIET_S1: true };
    // Shift 2's "meet-diaz" trigger branches on QUIET_S1
    expect(radioFor(2, "meet-diaz", quiet)?.speaker).toBe("DIAZ");
    expect(radioFor(2, "meet-diaz", notQuiet)?.speaker).toBe("VALE");
  });

  it("radioSequenceFor returns every matching cue in script order", () => {
    const seq = radioSequenceFor(1, "enter", defaultCampaignFlags());
    expect(seq.length).toBeGreaterThan(1);
    expect(seq.every((c) => c.shift === 1 && c.trigger === "enter")).toBe(true);
  });

  it("radioFor/radioSequenceFor return nothing for a trigger with no cues on that shift", () => {
    expect(radioFor(1, "vault-taken", defaultCampaignFlags())).toBeNull();
    expect(radioSequenceFor(1, "vault-taken", defaultCampaignFlags())).toEqual([]);
  });
});
