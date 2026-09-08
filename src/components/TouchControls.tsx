import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, Zap } from "lucide-react";

interface Props {
  onMoveStart: (dir: -1 | 1) => void;
  onMoveEnd: () => void;
  onJump: () => void;
  onDash: () => void;
  onAimStart: (clientX: number, clientY: number) => void;
  onAimMove: (clientX: number, clientY: number) => void;
  onAimEnd: () => void;
}

const btnClass =
  "flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white/80 backdrop-blur-sm active:bg-white/20 active:text-white touch-none select-none";

export default function TouchControls({
  onMoveStart,
  onMoveEnd,
  onJump,
  onDash,
  onAimStart,
  onAimMove,
  onAimEnd,
}: Props) {
  // pointerId of the finger that owns the aim drag, or null when idle. Using
  // the id (rather than a bare boolean) keeps a second finger touching the
  // aim surface from ending the first finger's drag.
  const aimPointer = useRef<number | null>(null);

  // If this component unmounts while a finger is still down (a level-up or
  // pause can flip mid-gesture), no pointerup/pointercancel ever fires — so
  // release the held move key and stop firing on the way out. Without this
  // the engine keeps auto-firing or auto-running with nothing on screen.
  useEffect(() => {
    return () => {
      aimPointer.current = null;
      onMoveEnd();
      onAimEnd();
    };
  }, [onMoveEnd, onAimEnd]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* drag-to-aim surface: right two-thirds of the screen */}
      <div
        className="pointer-events-auto absolute right-0 top-0 h-full w-2/3 touch-none"
        onPointerDown={(e) => {
          if (aimPointer.current !== null) return;
          aimPointer.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          onAimStart(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (aimPointer.current === e.pointerId) onAimMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (aimPointer.current !== e.pointerId) return;
          aimPointer.current = null;
          onAimEnd();
        }}
        onPointerCancel={(e) => {
          if (aimPointer.current !== e.pointerId) return;
          aimPointer.current = null;
          onAimEnd();
        }}
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

      {/* bottom-right: jump + dash (bottom-24 clears the HUD dash panel at bottom-6) */}
      <div className="pointer-events-auto absolute bottom-24 right-6 flex gap-4">
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onDash();
          }}
          aria-label="Dash"
        >
          <Zap className="h-7 w-7" />
        </button>
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onJump();
          }}
          aria-label="Jump"
        >
          <ArrowUp className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
