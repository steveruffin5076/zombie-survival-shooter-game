import { useState } from "react";
import {
  X, Play, Crosshair, Flashlight, Bot, Hand, Heart, Skull, Gem,
  Package, HeartPulse, Zap, Waves, ShieldAlert, Users,
} from "lucide-react";
import { ZOMBIE_INFO } from "../game/zombieInfo";

type Tab = "controls" | "hud" | "loadout" | "survival";
const TABS: { id: Tab; label: string }[] = [
  { id: "controls", label: "CONTROLS" },
  { id: "hud", label: "HUD & AIMING" },
  { id: "loadout", label: "WEAPONS" },
  { id: "survival", label: "SURVIVAL" },
];

/** A static, self-contained walkthrough — no engine coupling, just the same
 * copy a new player would otherwise have to piece together from playing.
 * Opened from the Menu; safe to reopen any time since it holds no game state. */
export default function Tutorial({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("controls");

  return (
    <div className="absolute inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-[6px]">
      <div className="anim-pop relative flex h-[560px] max-h-full w-full max-w-3xl flex-col rounded-xl border border-cyan-500/20 bg-zinc-950/95 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 mt-6 px-6 text-[12px] font-bold tracking-[0.4em] text-cyan-400/70">
          HOW TO PLAY
        </div>

        <div className="flex items-center gap-1 border-b border-white/10 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-bold tracking-[0.12em] transition ${
                tab === t.id ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "controls" && <ControlsTab />}
          {tab === "hud" && <HudTab />}
          {tab === "loadout" && <LoadoutTab />}
          {tab === "survival" && <SurvivalTab />}
        </div>

        <div className="flex justify-center border-t border-white/10 p-4">
          <button
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-b from-cyan-400 to-cyan-600 px-11 py-3.5 text-base font-bold tracking-[0.22em] text-cyan-950 shadow-[0_0_40px_rgba(34,211,238,0.3)] transition-all hover:scale-[1.03] active:scale-[0.98]"
          >
            <Play className="h-4 w-4" fill="currentColor" />
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2 text-[11px] font-bold tracking-[0.25em] text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm text-zinc-300">
      <div className="mt-0.5 shrink-0 text-cyan-400/80">{icon}</div>
      <div>{children}</div>
    </div>
  );
}

function ControlsTab() {
  return (
    <div>
      <Section title="MOVEMENT & AIM">
        <Row icon={<span className="kbd">W A S D</span>}>Move in any direction — this is a full 2D top-down world, not a lane shooter.</Row>
        <Row icon={<span className="kbd">MOUSE</span>}>Aim. Your flashlight and laser sight always point wherever the cursor is — you have to actually look toward a zombie to see it.</Row>
        <Row icon={<span className="kbd">SHIFT</span>}>Dash — a short burst of speed with brief invulnerability. Watch the DASH READY indicator bottom-right; it's on a cooldown.</Row>
      </Section>
      <Section title="COMBAT">
        <Row icon={<span className="kbd">CLICK</span>}>Fire, in manual mode — hold to keep firing.</Row>
        <Row icon={<span className="kbd">F</span>}>Toggle AUTO / MANUAL fire. See the HUD & AIMING tab for what each does.</Row>
        <Row icon={<span className="kbd">R</span>}>Reload. Also happens automatically the instant your mag runs dry.</Row>
        <Row icon={<span className="kbd">1</span>}>-<span className="kbd">4</span> Switch weapon class (pistol / SMG / shotgun / carbine) — see WEAPONS for how you unlock more.</Row>
      </Section>
      <Section title="WORLD">
        <Row icon={<span className="kbd">E</span>}>Hold near a crate to open it. Hold near the boss-arena's repair bench to fix a damaged barricade.</Row>
        <Row icon={<span className="kbd">B</span>} >Use a Bandage — heals a chunk of HP instantly.</Row>
        <Row icon={<span className="kbd">G</span>}>Throw a Grenade.</Row>
        <Row icon={<span className="kbd">T</span>}>Use a Tactical Stim.</Row>
        <Row icon={<span className="kbd">I</span>}>Open your backpack to see what you're carrying, any time.</Row>
        <Row icon={<span className="kbd">ESC</span>}>Pause.</Row>
      </Section>
    </div>
  );
}

function HudTab() {
  return (
    <div>
      <Section title="TOP-LEFT — VITALS">
        <Row icon={<Heart className="h-4 w-4" />}>Your health bar. Regenerates slowly on its own; a Bandage restores a big chunk instantly.</Row>
        <Row icon={<Zap className="h-4 w-4" />}>Level and XP bar. Leveling up mid-run offers an upgrade pick, and permanently raises your account's meta level over many runs — that's what unlocks new weapons.</Row>
      </Section>
      <Section title="TOP-CENTER — STAGE & WAVE">
        <Row icon={<Skull className="h-4 w-4" />}>Current stage, wave number, and how many zombies are left in the wave. A red pip marks a boss wave; watch for a HORDE banner on stages 5 and 10 — a sustained swarm with a tough boss-tier zombie mixed in.</Row>
      </Section>
      <Section title="AIMING — FLASHLIGHT & LASER">
        <Row icon={<Flashlight className="h-4 w-4" />}>Your mouse always points a lit cone in front of you — outside it, the world dims. A zombie has to be in that cone (and in weapon range) to be seen or shot.</Row>
        <Row icon={<Bot className="h-4 w-4 text-emerald-300" />}>
          <span className="font-semibold text-emerald-300">AUTO-FIRE</span> — once a zombie enters your lit cone, the laser snaps onto the nearest one and fires by itself. You still have to look toward the danger; you just don't have to land the exact shot.
        </Row>
        <Row icon={<Hand className="h-4 w-4 text-amber-300" />}>
          <span className="font-semibold text-amber-300">MANUAL</span> — the laser goes exactly where your mouse points, no snapping. You click to fire, and only hit what the laser is actually crossing. More control, more responsibility.
        </Row>
      </Section>
      <Section title="BOTTOM-LEFT — WEAPON">
        <Row icon={<Crosshair className="h-4 w-4" />}>Equipped weapon, its class slot, and current mag / reserve ammo. Reserve of ∞ means that weapon never needs an ammo box — pistols are always unlimited.</Row>
      </Section>
      <Section title="BOTTOM-RIGHT — TOOLS">
        <Row icon={<Package className="h-4 w-4" />}>Consumable counts (Bandage / Grenade / Stim) and the AUTO/MANUAL fire toggle.</Row>
      </Section>
    </div>
  );
}

function LoadoutTab() {
  return (
    <div>
      <Section title="WEAPON CLASSES">
        <p className="text-sm leading-relaxed text-zinc-400">
          There are four weapon classes — pistol, SMG, shotgun, and carbine — switchable
          any time with <span className="kbd">1</span>-<span className="kbd">4</span>. Each
          class has several weapons in it; you start with only the first of each unlocked.
        </p>
      </Section>
      <Section title="UNLOCKING NEW WEAPONS">
        <p className="text-sm leading-relaxed text-zinc-400">
          Kills, waves survived, and scrap all feed a permanent account level (separate from
          your in-run level) — every level up unlocks one more weapon somewhere across the
          four classes. The Loadout screen lists them left-to-right in unlock order, so you
          can see exactly what's coming next.
        </p>
      </Section>
      <Section title="THE LOADOUT SCREEN">
        <p className="text-sm leading-relaxed text-zinc-400">
          Opens from the main menu before a run, and again after every stage clear — so a
          level gained mid-run can actually be spent on a new weapon before you continue.
          Pick one weapon per class as your starting/current loadout; locked weapons show the
          account level that unlocks them. The PROFILE tab there tracks your lifetime stats,
          and the ZOMBIES tab is a compendium of every enemy type's speed and attack style.
        </p>
      </Section>
      <Section title="SAFE HOUSE RESUPPLY">
        <p className="text-sm leading-relaxed text-zinc-400">
          After picking your loadout between stages, the Safe House screen tops up your ammo
          reserve and lets you manage your backpack before the next stage starts.
        </p>
      </Section>
    </div>
  );
}

function SurvivalTab() {
  return (
    <div>
      <Section title="CRATES">
        <p className="mb-2 text-sm leading-relaxed text-zinc-400">
          Dropped after clearing a wave. Hold <span className="kbd">E</span> nearby to open —
          the crate names exactly what you got. They carry ammo boxes (auto-loaded into a
          weapon's reserve the instant it runs dry) and consumables.
        </p>
      </Section>
      <Section title="CONSUMABLES">
        <Row icon={<HeartPulse className="h-4 w-4" />}>Bandage (B) — instant HP.</Row>
        <Row icon={<ShieldAlert className="h-4 w-4" />}>Grenade (G) — thrown explosive, good against a cluster.</Row>
        <Row icon={<Zap className="h-4 w-4" />}>Stim (T) — a rarer, stronger combat boost.</Row>
      </Section>
      <Section title="WAVES, HORDES & BOSSES">
        <p className="mb-2 text-sm leading-relaxed text-zinc-400">
          Each stage is a series of waves, each tougher than the last. Stages 5 and 10 end
          their final wave as a 60-second horde — a continuous swarm with a boss-tier zombie
          — instead of a normal wave. Every 4th stage is a Terminal Defense stand: a fixed
          position you build barricades and defenses for, ending in a real boss fight.
        </p>
      </Section>
      <Section title="KNOW YOUR ENEMY">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ZOMBIE_INFO.map((z) => (
            <div key={z.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: z.tint, boxShadow: `0 0 6px ${z.tint}` }} />
              <div>
                <div className="text-sm font-semibold text-zinc-200">{z.name}</div>
                <div className="text-[11px] text-zinc-500">{z.attackStyle}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Users className="h-3 w-3" /> Full details — speed, danger notes — are in the Loadout screen's ZOMBIES tab.
        </p>
      </Section>
      <Section title="SCORE & PROGRESS">
        <Row icon={<Gem className="h-4 w-4" />}>Scrap feeds your account level and (on Terminal Defense stages) buys/repairs defenses.</Row>
        <Row icon={<Waves className="h-4 w-4" />}>Survive as many stages as you can — this is Endless mode, so it keeps going and keeps getting harder.</Row>
      </Section>
    </div>
  );
}
