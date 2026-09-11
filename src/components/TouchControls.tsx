import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Zap, Crosshair, Hand, Bot } from "lucide-react";

interface Props {
  onMoveStart: (dir: -1 | 1) => void;
  onMoveEnd: () => void;
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
  "flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-sm active:bg-white/20 active:text-white touch-none select-none";

export default function TouchControls({
  onMoveStart,
  onMoveEnd,
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
  // If this component unmounts while a finger is still down (a level-up or
  // pause can flip mid-gesture), no pointerup/pointercancel ever fires — so
  // release every held input on the way out. Without this the engine keeps
  // firing, running, or holding E with nothing on screen.
  useEffect(() => {
    return () => {
      onMoveEnd();
      onFireEnd();
      onInteractEnd();
    };
  }, [onMoveEnd, onFireEnd, onInteractEnd]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* tap-to-pivot / tap-to-place surface — auto-aim handles the rest, so this
       * only needs a discrete tap, not a tracked drag. Sits under every button
       * below (later in DOM order = on top for hit-testing), so it never steals
       * their taps. */}
      <div
        className="pointer-events-auto absolute inset-0 touch-none"
        onPointerDown={(e) => onTap(e.clientX, e.clientY)}
      />

      {/* bottom-left: move buttons (bottom-24 clears the HUD weapon panel at bottom-6) */}
      <div className="pointer-events-auto absolute bottom-24 left-6 flex gap-4">
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onMoveStart(-1);
          }}
          onPointerUp={onMoveEnd}
          onPointerCancel={onMoveEnd}
          onPointerLeave={onMoveEnd}
          aria-label="Move left"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onMoveStart(1);
          }}
          onPointerUp={onMoveEnd}
          onPointerCancel={onMoveEnd}
          onPointerLeave={onMoveEnd}
          aria-label="Move right"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
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
            <Hand className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* bottom-right: fire mode toggle + fire + dash. Hud.tsx hides its own
       * fire-mode-toggle/dash-ready panels on touch (`touch` prop) since they'd
       * render right on top of these buttons on a phone-size box — this
       * cluster is the only copy of that UI when a touch device is in play. */}
      <div className="pointer-events-auto absolute bottom-24 right-6 flex items-center gap-4">
        <button
          className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-sm touch-none select-none transition-colors ${
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
          {autoFire ? <Bot className="h-5 w-5" /> : <Hand className="h-5 w-5" />}
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
          <Crosshair className="h-7 w-7" />
        </button>
        <button
          className={`${btnClass} ${dashReady ? "border-cyan-300/60 text-cyan-200 shadow-[0_0_14px_rgba(103,232,249,0.4)]" : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            onDash();
          }}
          aria-label="Dash"
        >
          <Zap className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
