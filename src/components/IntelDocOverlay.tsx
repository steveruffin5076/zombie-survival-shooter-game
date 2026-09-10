import type { DocDef } from "../game/intel";
import { X, Newspaper, FileText, BookOpen } from "lucide-react";

const KIND_ICON = { newspaper: Newspaper, dossier: FileText, diary: BookOpen };

/** Cinematic single-document reader, opened from the Hideout board. */
export default function IntelDocOverlay({ doc, onClose }: { doc: DocDef; onClose: () => void }) {
  const Icon = KIND_ICON[doc.kind];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-[6px]" onClick={onClose}>
      <div
        className="anim-pop relative w-full max-w-lg rounded-xl border border-white/15 bg-zinc-950/95 p-6 text-left shadow-[0_0_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-white/25 hover:text-white"
          aria-label="Close document"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-2.5 border-b border-white/10 pb-4">
          <Icon className="h-5 w-5 text-violet-300" />
          <div>
            <div className="font-display text-lg tracking-[0.08em] text-zinc-100">{doc.masthead}</div>
            <div className="text-[10px] font-semibold tracking-wide text-zinc-500">{doc.dateline}</div>
          </div>
        </div>

        {doc.headline !== "no title" && (
          <h3 className="mb-3 text-sm font-bold uppercase leading-snug tracking-wide text-amber-300">{doc.headline}</h3>
        )}

        <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
          {doc.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
