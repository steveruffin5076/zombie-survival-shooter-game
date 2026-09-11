import { useCallback, useEffect, useRef, useState } from "react";
import { Zap, Hand, Bot } from "lucide-react";

interface Props {
  /** left stick deflection, each axis -1..1; (0,0) on release */
  onMove: (x: number, y: number) => void;
  /** right stick deflection, each axis -1..1; (0,0) on release */
  onAim: (x: number, y: number) => void;
  onDash: () => void;
  /** tap-to-place, used for arena deployables during prep */
  onTap: (clientX: number, clientY: number) => void;
  onFireStart: () => void;
  onFireEnd: () => void;
  /** held-E equivalent: crate open / gate bypass / boss force-target */
  showInteract: boolean;
  onInteractStart: () => void;
  onInteractEnd: () => void;
  /** dash cooldown is done — tints the Dash button instead of a separate
   * status readout, since that would sit right where these buttons are */
  dashReady: boolean;
  /** auto vs manual trigger — Hud hides its own toggle on touch (same
   * bottom-right corner these buttons occupy) so this is its only control */
  autoFire: boolean;
  onToggleFireMode: () => void;
}

const btnClass =
  "flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-sm active:bg-white/20 active:text-white touch-none select-none";

/** stick travel radius, in the same 1280x720 space the rest of the UI layer is
 * authored in (App.tsx scales the whole layer to fit the box) */
const STICK_R = 92;
/** ignore the first slice of travel so resting a thumb doesn't twitch the aim */
const DEADZONE = 0.15;

/** One analog stick. Reports deflection as a -1..1 vector per axis, measured
 * against its own on-screen radius so it works at any UI scale. */
function Stick({
  side, label, tint, onVector,
}: {
  side: "left" | "right";
  label: string;
  tint: string;
  onVector: (x: number, y: number) => void;
}) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  // read through a ref so the release-on-unmount effect below can hold no deps:
  // the HUD re-renders every 66ms, and an onVector in the dep array would make
  // that effect tear down and re-run — zeroing the stick mid-drag, every tick
  const onVectorRef = useRef(onVector);
  onVectorRef.current = onVector;

  const drive = (clientX: number, clientY: number, scale: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const r = STICK_R * scale;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > r ? r / dist : 1;
    setKnob({ x: (dx * clamped) / scale, y: (dy * clamped) / scale });
    const nx = dx / r;
    const ny = dy / r;
    if (Math.hypot(nx, ny) < DEADZONE) {
      onVector(0, 0);
      return;
    }
    onVector(Math.max(-1, Math.min(1, nx)), Math.max(-1, Math.min(1, ny)));
  };

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onVector(0, 0);
  };

  // a stick unmounted mid-drag (level-up, pause) never sees its pointerup
  useEffect(() => () => onVectorRef.current(0, 0), []);

  return (
    <div
      className="pointer-events-auto absolute touch-none select-none"
      style={{
        [side]: 40, bottom: 40,
        width: STICK_R * 2, height: STICK_R * 2,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        pointerId.current = e.pointerId;
        const box = el.getBoundingClientRect();
        origin.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
        // the UI layer is uniformly scaled, so one measured axis gives the factor
        drive(e.clientX, e.clientY, box.width / (STICK_R * 2));
      }}
      onPointerMove={(e) => {
        if (pointerId.current !== e.pointerId) return;
        const box = e.currentTarget.getBoundingClientRect();
        drive(e.clientX, e.clientY, box.width / (STICK_R * 2));
      }}
      onPointerUp={release}
      onPointerCancel={release}
      aria-label={label}
    >
      <div className={`absolute inset-0 rounded-full border bg-black/35 backdrop-blur-sm ${tint}`} />
      <div
        className="absolute rounded-full border border-white/25 bg-white/20"
        style={{
          width: STICK_R, height: STICK_R,
          left: STICK_R / 2, top: STICK_R / 2,
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      />
    </div>
  );
}

export default function TouchControls({
  onMove,
  onAim,
  onDash,
  onTap,
  onFireStart,
  onFireEnd,
  showInteract,
  onInteractStart,
  onInteractEnd,
  dashReady,
  autoFire,
  onToggleFireMode,
}: Props) {
  const firing = useRef(false);

  useEffect(() => {
    return () => {
      onFireEnd();
      onInteractEnd();
    };
  }, [onFireEnd, onInteractEnd]);

  /** Twin-stick: the right stick points the flashlight cone AND pulls the
   * trigger while it's deflected, so aiming and firing are one thumb. In
   * auto-fire mode the engine still gates on a target being in the cone;
   * this just decides where the cone points. */
  const aimAndFire = useCallback((x: number, y: number) => {
    onAim(x, y);
    const live = x !== 0 || y !== 0;
    if (live === firing.current) return;
    firing.current = live;
    if (live) onFireStart();
    else onFireEnd();
  }, [onAim, onFireStart, onFireEnd]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* tap surface — only used to place arena deployables during prep now
       * that the right stick owns aiming. Sits under everything below (later
       * in DOM order = on top for hit-testing) so it never steals their taps. */}
      <div
        className="pointer-events-auto absolute inset-0 touch-none"
        onPointerDown={(e) => onTap(e.clientX, e.clientY)}
      />

      {/* left: move. Full 360° — this is a top-down game, and the old
       * left/right button pair couldn't go up or down at all. */}
      <Stick side="left" label="Move" tint="border-white/15" onVector={onMove} />

      {/* right: aim + fire */}
      <Stick side="right" label="Aim and fire" tint="border-amber-400/25" onVector={aimAndFire} />

      {/* interact — only shown near a crate/gate, mirrors held KeyE */}
      {showInteract && (
        <div className="pointer-events-auto absolute bottom-56 left-1/2 -translate-x-1/2">
          <button
            className={btnClass}
            onPointerDown={(e) => {
              e.preventDefault();
              onInteractStart();
            }}
            onPointerUp={onInteractEnd}
            onPointerCancel={onInteractEnd}
            onPointerLeave={onInteractEnd}
            aria-label="Interact"
          >
            <Hand className="h-9 w-9" />
          </button>
        </div>
      )}

      {/* dash + fire-mode sit above the right stick, clear of both thumbs.
       * Hud.tsx hides its own fire-mode/dash panels on touch (`touch` prop),
       * so this is the only copy of that UI on a touch device. */}
      <div className="pointer-events-auto absolute bottom-60 right-6 flex flex-col items-center gap-4">
        <button
          className={`${btnClass} ${dashReady ? "border-cyan-300/60 text-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.4)]" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            onDash();
          }}
          aria-label="Dash"
        >
          <Zap className="h-9 w-9" />
        </button>
        <button
          className={`flex h-16 w-16 items-center justify-center rounded-full border backdrop-blur-sm touch-none select-none transition-colors ${
            autoFire
              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
              : "border-amber-400/50 bg-amber-500/15 text-amber-200"
          }`}
          onPointerDown={(e) => {
            e.preventDefault();
            onToggleFireMode();
          }}
          aria-label={autoFire ? "Switch to manual fire" : "Switch to auto fire"}
        >
          {autoFire ? <Bot className="h-7 w-7" /> : <Hand className="h-7 w-7" />}
        </button>
      </div>
    </div>
  );
}
