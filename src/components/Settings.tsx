import { X, Sun, Volume2, Search } from "lucide-react";

interface Props {
  volume: number;
  brightness: number;
  zoom: number;
  onVolumeChange: (v: number) => void;
  onBrightnessChange: (v: number) => void;
  onZoomChange: (v: number) => void;
  onClose: () => void;
}

/** Brightness (a CSS filter on the canvas, HUD stays unaffected so it's always
 * legible), SFX volume (the WebAudio master gain, independent of the quick mute
 * toggle), and world zoom (an engine-side magnification of the canvas). Safe to
 * open any time — from the main menu or paused mid-run. */
export default function Settings({
  volume, brightness, zoom, onVolumeChange, onBrightnessChange, onZoomChange, onClose,
}: Props) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-[6px]">
      <div className="anim-pop relative flex max-h-full w-full max-w-md flex-col gap-6 overflow-y-auto rounded-xl border border-amber-500/20 bg-zinc-950/95 p-6 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        {/* the close button shares a row with the title rather than floating over the
          * panel: it grows to a 44px touch target on phones (see .ui-layer in index.css)
          * and an absolute one at that size covers the first setting's readout */}
        <div className="flex items-start justify-between gap-3">
          <div className="text-[12px] font-bold tracking-[0.4em] text-amber-400/70">SETTINGS</div>
          <button
            onClick={onClose}
            className="-mr-2 -mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-bold tracking-[0.1em] text-zinc-300">
            <span className="flex items-center gap-2"><Sun className="h-4 w-4 text-amber-300" /> BRIGHTNESS</span>
            <span className="text-zinc-500">{Math.round(brightness * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={brightness}
            onChange={(e) => onBrightnessChange(Number(e.target.value))}
            className="accent-amber-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-bold tracking-[0.1em] text-zinc-300">
            <span className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-amber-300" /> SOUND EFFECTS</span>
            <span className="text-zinc-500">{Math.round(volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="accent-amber-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm font-bold tracking-[0.1em] text-zinc-300">
            <span className="flex items-center gap-2"><Search className="h-4 w-4 text-amber-300" /> ZOOM</span>
            <span className="text-zinc-500">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="accent-amber-400"
          />
        </div>

        <div className="text-[11px] leading-relaxed text-zinc-600">
          Brightness only affects the game view — the HUD stays fully readable at any level.
          Zooming in makes the world bigger but shows less of the map, so zombies come into
          view later.
        </div>
      </div>
    </div>
  );
}
