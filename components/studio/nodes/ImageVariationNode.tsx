'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

const MODEL_OPTIONS = [
  { value: 'flux-redux', label: 'Flux Redux', provider: 'fal' },
  { value: 'ip-adapter-sdxl', label: 'IP-Adapter + SDXL', provider: 'replicate' },
];

function ImageVariationNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const d = data as {
    model: string;
    strength: number;
    stylePrompt: string;
    outputImages: string[];
    isRunning: boolean;
    error: string | null;
  };

  const currentUserId = useStudioStore((s) => s.currentUserId);

  const handleRun = useCallback(async () => {
    const upstream = getUpstreamData(id);
    if (!upstream.imageUrl) {
      updateNodeData(id, { error: 'Connect an image source node first' });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, outputImages: [] });

    try {
      const selectedModel = MODEL_OPTIONS.find((m) => m.value === d.model) || MODEL_OPTIONS[0];
      const res = await fetch('/api/studio/image-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId || undefined,
          imageUrl: upstream.imageUrl,
          prompt: upstream.prompt || d.stylePrompt || '',
          model: d.model,
          provider: selectedModel.provider,
          strength: d.strength,
          stylePrompt: d.stylePrompt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Variation failed');
      }

      const result = await res.json();
      updateNodeData(id, { outputImages: result.images, isRunning: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, d.model, d.strength, d.stylePrompt, currentUserId, getUpstreamData, updateNodeData]);

  return (
    <div className="relative w-[380px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-orange-600/20 to-amber-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-orange-500/20 flex items-center justify-center">
          <i className="fa-solid fa-shuffle text-orange-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">IMAGE VARIATION</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">Model</label>
          <select
            value={d.model}
            onChange={(e) => updateNodeData(id, { model: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-orange-500/50 transition-all appearance-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#1a1a1a]">{m.label}</option>
            ))}
          </select>
        </div>

        {/* Strength slider */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 flex items-center justify-between">
            <span>Strength</span>
            <span className="text-white/60">{d.strength}</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={d.strength}
            onChange={(e) => updateNodeData(id, { strength: parseFloat(e.target.value) })}
            className="w-full accent-orange-500"
          />
        </div>

        {/* Style prompt */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">
            Style Modifier
          </label>
          <input
            type="text"
            value={d.stylePrompt}
            onChange={(e) => updateNodeData(id, { stylePrompt: e.target.value })}
            placeholder="e.g., side view, watercolor..."
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 transition-all"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={d.isRunning}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Processing...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Generate Variation
            </>
          )}
        </button>

        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{d.error}</div>
        )}

        {d.outputImages?.length > 0 && (
          <div className="space-y-1.5">
            {d.outputImages.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Variation ${i + 1}`} className="w-full rounded-lg border border-white/5" />
            ))}
          </div>
        )}
      </div>
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(ImageVariationNode);
