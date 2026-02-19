'use client';

import { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

const MODEL_OPTIONS = [
  { value: 'local-animatediff', label: 'AnimateDiff', vram: '4 GB', speed: '~3 min', duration: 2 },
  { value: 'local-cogvideo', label: 'CogVideoX', vram: '16 GB', speed: '~2 min', duration: 6 },
  { value: 'local-hunyuan', label: 'Hunyuan Video', vram: '16 GB', speed: '~3 min', duration: 4 },
  { value: 'local-opensora', label: 'Open-Sora', vram: '12 GB', speed: '~2 min', duration: 4 },
  { value: 'local-wan21', label: 'Wan 2.1', vram: '12 GB', speed: '~2 min', duration: 4 },
];

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 Wide' },
  { value: '9:16', label: '9:16 Tall' },
  { value: '1:1', label: '1:1 Square' },
  { value: '4:3', label: '4:3 Standard' },
];

function VideoGenNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);

  const d = data as {
    model: string;
    duration: number;
    aspectRatio: string;
    outputUrl: string | null;
    isRunning: boolean;
    progress: number;
    error: string | null;
  };

  const selectedModel = useMemo(() => MODEL_OPTIONS.find((m) => m.value === d.model), [d.model]);

  const handleRun = useCallback(async () => {
    const upstream = getUpstreamData(id);
    if (!upstream.prompt && !upstream.imageUrl) {
      updateNodeData(id, { error: 'Connect a Text Prompt or Image source node first' });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, outputUrl: null, progress: 0 });

    try {
      const fetchRes = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: upstream.prompt || '',
          model: d.model,
          aspectRatio: d.aspectRatio || '16:9',
        }),
      });

      if (!fetchRes.ok) {
        let errMsg = 'Video generation failed';
        try {
          const err = await fetchRes.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server error (${fetchRes.status})`;
        }
        throw new Error(errMsg);
      }

      const result = await fetchRes.json();

      if (result.outputUrl) {
        updateNodeData(id, { outputUrl: result.outputUrl, isRunning: false, progress: 100 });
      } else {
        throw new Error('No video URL returned. Try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, d.model, d.aspectRatio, getUpstreamData, updateNodeData]);

  const batchVideoTrigger = useStudioStore((s) => s.batchVideoTrigger);
  const prevBatchRef = useRef(batchVideoTrigger);
  useEffect(() => {
    if (batchVideoTrigger > 0 && batchVideoTrigger !== prevBatchRef.current) {
      prevBatchRef.current = batchVideoTrigger;
      if (!d.isRunning) handleRun();
    }
  }, [batchVideoTrigger, d.isRunning, handleRun]);

  return (
    <div className="bg-[#141414] border border-white/10 rounded-xl w-[400px] shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-rose-600/20 to-pink-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-rose-500/20 flex items-center justify-center">
          <i className="fa-solid fa-film text-rose-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">VIDEO GENERATION</span>
        <span className="ml-auto text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">
          LOCAL
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">
            Model
          </label>
          <select
            value={d.model}
            onChange={(e) => updateNodeData(id, { model: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-rose-500/50 transition-all appearance-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#1a1a1a]">
                {m.label} — {m.speed} ({m.vram})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">
            Aspect Ratio
          </label>
          <div className="flex gap-1 flex-wrap">
            {ASPECT_RATIOS.map((ar) => (
              <button
                key={ar.value}
                onClick={() => updateNodeData(id, { aspectRatio: ar.value })}
                className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  (d.aspectRatio || '16:9') === ar.value
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                    : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
          <i className="fa-solid fa-clock text-[9px] text-white/30"></i>
          <span className="text-[10px] text-white/40">
            ~{selectedModel?.duration || 2}s clip, {selectedModel?.speed || '~3 min'} render time
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">LOCAL GPU — Free, unlimited</span>
        </div>

        <button
          onClick={handleRun}
          disabled={d.isRunning}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-rose-600 hover:bg-rose-500 text-white"
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Generating...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Generate Video
            </>
          )}
        </button>

        {d.isRunning && (
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{d.error}</div>
        )}

        {d.outputUrl && (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden border border-white/10">
              <video src={d.outputUrl} controls autoPlay loop muted className="w-full" />
            </div>
            <a
              href={d.outputUrl}
              download={`draftly-video-${Date.now()}.mp4`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 bg-rose-600/20 text-rose-300 hover:bg-rose-600/40 border border-rose-500/20"
            >
              <i className="fa-solid fa-download text-[10px]"></i>
              Download Video
            </a>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(VideoGenNode);
