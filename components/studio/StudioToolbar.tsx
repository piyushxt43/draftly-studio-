'use client';

import { useStudioStore } from '@/lib/studio-store';

export default function StudioToolbar() {
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const undoStack = useStudioStore((s) => s.undoStack);
  const redoStack = useStudioStore((s) => s.redoStack);
  const loadTemplate = useStudioStore((s) => s.loadTemplate);
  const triggerBatchImages = useStudioStore((s) => s.triggerBatchImages);
  const triggerBatchVideos = useStudioStore((s) => s.triggerBatchVideos);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <i className="fa-solid fa-diagram-project text-white text-[10px]"></i>
          </div>
          <span className="text-sm font-bold text-white/90">Draftly Studio</span>
          <span className="text-[9px] font-mono text-emerald-400/60 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">
            OSS
          </span>
        </div>

        <div className="w-px h-5 bg-white/10" />

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Undo (Ctrl+Z)"
          >
            <i className="fa-solid fa-rotate-left text-xs"></i>
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Redo (Ctrl+Y)"
          >
            <i className="fa-solid fa-rotate-right text-xs"></i>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          onChange={(e) => { if (e.target.value) loadTemplate(e.target.value); e.target.value = ''; }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>Load Template...</option>
          <option value="simple">Simple (Text → Image)</option>
          <option value="quick-image-5">5 Images + 5 Videos</option>
        </select>

        <button
          onClick={triggerBatchImages}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/20 hover:bg-blue-600/30 transition-all flex items-center gap-1.5"
        >
          <i className="fa-solid fa-images text-[10px]"></i>
          Generate All Images
        </button>

        <button
          onClick={triggerBatchVideos}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600/20 text-rose-300 border border-rose-500/20 hover:bg-rose-600/30 transition-all flex items-center gap-1.5"
        >
          <i className="fa-solid fa-film text-[10px]"></i>
          Generate All Videos
        </button>
      </div>
    </div>
  );
}
