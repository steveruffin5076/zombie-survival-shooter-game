import { X, Sun, Volume2 } from "lucide-react";

interface Props {
  volume: number;
  brightness: number;
  onVolumeChange: (v: number) => void;
  onBrightnessChange: (v: number) => void;
  onClose: () => void;
}

/** Menu-only settings — brightness (a CSS filter on the canvas, HUD stays
 * unaffected so it's always legible) and SFX volume (the WebAudio master
 * gain, independent of the quick mute toggle). No engine state, so it's
 * safe to open any time from the main menu. */
export default function Settings({ volume, brightness, onVolumeChange, onBrightnessChange, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-50 flex items-center-safe justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-[6px]">
      <div className="anim-pop relative flex max-h-full w-full max-w-md flex-col gap-6 overflow-y-auto rounded-xl border border-amber-500/20 bg-zinc-950/95 p-6 shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-[12px] font-bold tracking-[0.4em] text-amber-400/70">SETTINGS</div>

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

        <div className="text-[11px] leading-relaxed text-zinc-600">
          Brightness only affects the game view — the HUD stays fully readable at any level.
        </div>
      </div>
    </div>
  );
}
