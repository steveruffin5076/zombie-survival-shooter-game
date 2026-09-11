import { useEffect, useRef, useState } from "react";
import { Zap, Crosshair, Hand, Bot } from "lucide-react";

interface Props {
  /** analog stick deflection, each axis -1..1; (0,0) on release */
  onMove: (x: number, y: number) => void;
  onDash: () => void;
  /** tap-to-act: pivots the lane, or places the selected deployable during prep */
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
  "flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-sm active:bg-white/20 active:text-white touch-none select-none";

/** radius of the stick's travel, in the same 1280x720 space the rest of the
 * UI layer is authored in (App.tsx scales the whole layer to fit the box) */
const STICK_R = 92;

export default function TouchControls({
  onMove,
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
  // knob offset in px for rendering; the engine gets the normalized vector
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const stickId = useRef<number | null>(null);
  const aimId = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  // If this component unmounts while a finger is still down (a level-up or
  // pause can flip mid-gesture), no pointerup/pointercancel ever fires — so
  // release every held input on the way out. Without this the engine keeps
  // firing, running, or holding E with nothing on screen.
  useEffect(() => {
    return () => {
      onMove(0, 0);
      onFireEnd();
      onInteractEnd();
    };
  }, [onMove, onFireEnd, onInteractEnd]);

  /** Client px -> knob offset + normalized vector. The stick is scaled along
   * with the rest of the UI layer, so measure its real on-screen radius from
   * the element instead of assuming STICK_R px. */
  const driveStick = (clientX: number, clientY: number, scale: number) => {
    const dx = clientX - origin.current.x;
    const dy = clientY - origin.current.y;
    const r = STICK_R * scale;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > r ? r / dist : 1;
    setKnob({ x: (dx * clamped) / scale, y: (dy * clamped) / scale });
    // normalized against the travel radius: edge of the ring = full speed
    onMove(Math.max(-1, Math.min(1, dx / r)), Math.max(-1, Math.min(1, dy / r)));
  };

  const releaseStick = () => {
    stickId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* aim / place surface. Aiming points the flashlight cone, so it tracks
       * the finger while it's down rather than only on the initial tap —
       * otherwise you have to keep re-tapping to sweep the cone around. Sits
       * under every button below (later in DOM order = on top for hit-testing),
       * so it never steals their taps. */}
      <div
        className="pointer-events-auto absolute inset-0 touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          aimId.current = e.pointerId;
          onTap(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (aimId.current === e.pointerId) onTap(e.clientX, e.clientY);
        }}
        onPointerUp={() => { aimId.current = null; }}
        onPointerCancel={() => { aimId.current = null; }}
      />

      {/* bottom-left: analog stick. This is a full 2D top-down game, so
       * movement needs 360° — the old left/right pair couldn't go up or down
       * at all. Drag anywhere inside the ring; partial deflection walks. */}
      <div
        className="pointer-events-auto absolute touch-none select-none"
        style={{ left: 40, bottom: 40, width: STICK_R * 2, height: STICK_R * 2 }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = e.currentTarget;
          el.setPointerCapture(e.pointerId);
          stickId.current = e.pointerId;
          const box = el.getBoundingClientRect();
          origin.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          // the UI layer is uniformly scaled, so one measured axis gives it
          driveStick(e.clientX, e.clientY, box.width / (STICK_R * 2));
        }}
        onPointerMove={(e) => {
          if (stickId.current !== e.pointerId) return;
          const box = e.currentTarget.getBoundingClientRect();
          driveStick(e.clientX, e.clientY, box.width / (STICK_R * 2));
        }}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        aria-label="Move"
      >
        <div className="absolute inset-0 rounded-full border border-white/15 bg-black/35 backdrop-blur-sm" />
        <div
          className="absolute rounded-full border border-white/25 bg-white/20"
          style={{
            width: STICK_R, height: STICK_R,
            left: STICK_R / 2, top: STICK_R / 2,
            transform: `translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>

      {/* interact — only shown near a crate/gate, mirrors held KeyE */}
      {showInteract && (
        <div className="pointer-events-auto absolute bottom-52 left-1/2 -translate-x-1/2">
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
            <Hand className="h-10 w-10" />
          </button>
        </div>
      )}

      {/* bottom-right: fire mode toggle + fire + dash. Hud.tsx hides its own
       * fire-mode-toggle/dash-ready panels on touch (`touch` prop) since they'd
       * render right on top of these buttons on a phone-size box — this
       * cluster is the only copy of that UI when a touch device is in play. */}
      <div className="pointer-events-auto absolute bottom-24 right-6 flex items-center gap-4">
        <button
          className={`flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-sm touch-none select-none transition-colors ${
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
          {autoFire ? <Bot className="h-9 w-9" /> : <Hand className="h-9 w-9" />}
        </button>
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onFireStart();
          }}
          onPointerUp={onFireEnd}
          onPointerCancel={onFireEnd}
          onPointerLeave={onFireEnd}
          aria-label="Fire"
        >
          <Crosshair className="h-10 w-10" />
        </button>
        <button
          className={`${btnClass} ${dashReady ? "border-cyan-300/60 text-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.4)]" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            onDash();
          }}
          aria-label="Dash"
        >
          <Zap className="h-10 w-10" />
        </button>
      </div>
    </div>
  );
}
