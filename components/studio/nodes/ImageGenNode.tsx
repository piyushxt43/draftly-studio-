'use client';

import { memo, useCallback, useMemo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

const MODEL_OPTIONS = [
  { value: 'local-sd15', label: 'Stable Diffusion 1.5', vram: '4 GB', speed: '~15s' },
  { value: 'local-sdxl', label: 'Stable Diffusion XL', vram: '8 GB', speed: '~5s' },
  { value: 'local-flux', label: 'Flux.1 Dev', vram: '12 GB', speed: '~8s' },
];

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Wide' },
  { value: '9:16', label: '9:16 Tall' },
  { value: '4:3', label: '4:3 Standard' },
  { value: '3:4', label: '3:4 Portrait' },
];

function ImageGenNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const d = data as {
    model: string;
    aspectRatio: string;
    numOutputs: number;
    guidanceScale: number;
    outputImages: string[];
    isRunning: boolean;
    error: string | null;
  };

  const upstreamInfo = useMemo(() => {
    const upstream = getUpstreamData(id);
    return {
      hasPrompt: !!upstream.prompt,
      hasImage: !!upstream.imageUrl,
      imageCount: upstream.imageUrls.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getUpstreamData]);

  const handleRun = useCallback(async () => {
    const upstream = getUpstreamData(id);
    if (!upstream.prompt && !upstream.imageUrl) {
      updateNodeData(id, { error: 'Connect a Text Prompt or Image Upload node first' });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, outputImages: [] });

    try {
      const fetchRes = await fetch('/api/studio/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: upstream.prompt || '',
          style: upstream.style || 'photorealistic',
          model: d.model,
          aspectRatio: d.aspectRatio || '1:1',
          guidanceScale: d.guidanceScale,
        }),
      });

      if (!fetchRes.ok) {
        let errMsg = 'Generation failed';
        try {
          const err = await fetchRes.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server error (${fetchRes.status})`;
        }
        throw new Error(errMsg);
      }

      const result = await fetchRes.json();
      updateNodeData(id, { outputImages: result.images, isRunning: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, d.model, d.aspectRatio, d.guidanceScale, getUpstreamData, updateNodeData]);

  const batchImageTrigger = useStudioStore((s) => s.batchImageTrigger);
  const prevBatchRef = useRef(batchImageTrigger);
  useEffect(() => {
    if (batchImageTrigger > 0 && batchImageTrigger !== prevBatchRef.current) {
      prevBatchRef.current = batchImageTrigger;
      if (!d.isRunning) handleRun();
    }
  }, [batchImageTrigger, d.isRunning, handleRun]);

  return (
    <div className="bg-[#141414] border border-white/10 rounded-xl w-[400px] shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
          <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">IMAGE GENERATION</span>
        <span className="ml-auto text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">
          LOCAL
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-2 text-[10px]">
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${upstreamInfo.hasPrompt ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'}`}>
            <i className="fa-solid fa-pen-fancy text-[8px]"></i>
            Text
          </div>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${upstreamInfo.hasImage ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/20'}`}>
            <i className="fa-solid fa-image text-[8px]"></i>
            {upstreamInfo.imageCount > 1
              ? `${upstreamInfo.imageCount} Images`
              : upstreamInfo.hasImage
                ? 'Image'
                : 'No Image'}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">
            Model
          </label>
          <select
            value={d.model}
            onChange={(e) => updateNodeData(id, { model: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
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
                  (d.aspectRatio || '1:1') === ar.value
                    ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                    : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-green-400 font-medium">LOCAL GPU — Free, unlimited</span>
        </div>

        <button
          onClick={handleRun}
          disabled={d.isRunning}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Generating...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Generate
            </>
          )}
        </button>

        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {d.error}
          </div>
        )}

        {d.outputImages?.length > 0 && (
          <div className="space-y-2">
            {d.outputImages.map((url: string, i: number) => (
              <div key={i} className="space-y-1.5">
                <div className="relative group rounded-lg overflow-hidden border border-white/10">
                  <img src={url} alt={`Generated ${i + 1}`} className="w-full object-cover" />
                </div>
                <button
                  className="w-full py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(url, '_blank');
                  }}
                >
                  <i className="fa-solid fa-download text-[10px]"></i>
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(ImageGenNode);
