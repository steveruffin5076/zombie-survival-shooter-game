import { useState } from "react";
import type { InventorySnapshot } from "../game/types";
import { ACTS } from "../game/acts";
import { docsForAct, type DocDef } from "../game/intel";
import { CAMPAIGN_ARSENAL, WEAPONS, CLASS_LABEL } from "../game/weapons";
import IntelDocOverlay from "./IntelDocOverlay";
import { X, Newspaper, Crosshair, Lock } from "lucide-react";

// Act I is the only act with real content so far — see docs/progress.md's
// Phase 8-12 writeups. Grows as each act's own phase lands.
const PLAYABLE_ACTS = new Set([1]);

type Tab = "missions" | "loadout" | "intel";
const TABS: Tab[] = ["missions", "loadout", "intel"];

interface Props {
  inv: InventorySnapshot;
  onClose: () => void;
  onStartMission: () => void;
  onSelectLoadout: (weaponId: string) => void;
}

/** Opened by interacting with the Hideout's terminal — the campaign's actual hub screen. */
export default function HideoutTerminal({ inv, onClose, onStartMission, onSelectLoadout }: Props) {
  const [tab, setTab] = useState<Tab>("missions");
  const [openDoc, setOpenDoc] = useState<DocDef | null>(null);
  const [loadout, setLoadout] = useState(CAMPAIGN_ARSENAL[0]);
  const docActs = ACTS.filter((a) => docsForAct(a.id).length > 0);

  const pickLoadout = (wid: string) => {
    setLoadout(wid);
    onSelectLoadout(wid);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-[6px]">
      <div className="anim-pop relative flex h-[520px] w-full max-w-3xl flex-col rounded-xl border border-red-500/20 bg-zinc-950/95 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:text-white"
          aria-label="Close terminal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 mt-6 px-6 text-[10px] font-bold tracking-[0.4em] text-red-400/70">AETHERIS NETWORK ACCESS — TERMINAL 04</div>

        <div className="flex items-center gap-1 border-b border-white/10 px-6">
          {TABS.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-t-lg px-4 py-2 text-xs font-bold tracking-[0.15em] transition ${
                tab === k ? "bg-red-500/15 text-red-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center overflow-y-auto p-6">
          {tab === "missions" && (
            <div className="flex flex-col items-center gap-5">
              <div className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">SELECT ACT</div>
              <div className="grid grid-cols-3 gap-3">
                {ACTS.map((act) => {
                  const playable = PLAYABLE_ACTS.has(act.id);
                  return (
                    <button
                      key={act.id}
                      onClick={() => playable && onStartMission()}
                      disabled={!playable}
                      className={`flex w-40 flex-col items-center gap-1.5 rounded-lg border p-4 text-center transition ${
                        playable
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:scale-[1.03] hover:border-amber-400/70"
                          : "cursor-not-allowed border-white/10 bg-white/[0.02] text-zinc-700"
                      }`}
                    >
                      {playable ? <span className="font-display text-2xl">{act.numeral}</span> : <Lock className="h-5 w-5" />}
                      <span className="text-[10px] font-bold leading-tight tracking-wide">{act.name}</span>
                      {!playable && <span className="text-[9px] text-zinc-600">coming soon</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "loadout" && (
            <div className="flex flex-col items-center gap-5">
              <div className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">CHOOSE YOUR LOADOUT</div>
              <div className="flex gap-3">
                {CAMPAIGN_ARSENAL.map((wid) => {
                  const w = WEAPONS[wid];
                  const active = loadout === wid;
                  return (
                    <button
                      key={wid}
                      onClick={() => pickLoadout(wid)}
                      className={`flex w-36 flex-col items-center gap-1.5 rounded-lg border p-4 text-center transition ${
                        active
                          ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                      }`}
                    >
                      <Crosshair className="h-5 w-5" />
                      <span className="text-xs font-bold leading-tight">{w.name}</span>
                      <span className="text-[9px] tracking-wide text-zinc-500">{CLASS_LABEL[w.cls]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="max-w-sm text-center text-xs leading-relaxed text-zinc-600">
                {WEAPONS[loadout].desc}
              </div>
            </div>
          )}

          {tab === "intel" && (
            <div className="flex flex-col items-center gap-6">
              {docActs.length === 0 && <div className="text-sm text-zinc-600">No intel filed yet.</div>}
              {docActs.map((act) => (
                <div key={act.id} className="flex flex-col items-center gap-2">
                  <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500">{act.name}</div>
                  <div className="flex gap-3">
                    {docsForAct(act.id).map((doc) => {
                      const found = inv.docs.includes(doc.id);
                      return (
                        <button
                          key={doc.id}
                          onClick={() => found && setOpenDoc(doc)}
                          disabled={!found}
                          title={found ? doc.masthead : "not yet found"}
                          className={`flex h-14 w-14 items-center justify-center rounded-lg border transition-all ${
                            found
                              ? "border-violet-400/40 bg-violet-400/10 text-violet-300 hover:scale-105 hover:border-violet-400/70"
                              : "cursor-not-allowed border-white/10 bg-white/[0.02] text-zinc-700"
                          }`}
                        >
                          <Newspaper className="h-6 w-6" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {openDoc && <IntelDocOverlay doc={openDoc} onClose={() => setOpenDoc(null)} />}
    </div>
  );
}
