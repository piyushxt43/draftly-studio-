'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

function UpscaleNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const d = data as {
    scale: number;
    outputImage: string | null;
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

    updateNodeData(id, { isRunning: true, error: null, outputImage: null });

    try {
      const res = await fetch('/api/studio/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId || undefined,
          imageUrl: upstream.imageUrl,
          scale: d.scale,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upscale failed');
      }

      const result = await res.json();
      updateNodeData(id, { outputImage: result.image, isRunning: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, d.scale, currentUserId, getUpstreamData, updateNodeData]);

  return (
    <div className="relative w-[360px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-cyan-600/20 to-sky-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-cyan-500/20 flex items-center justify-center">
          <i className="fa-solid fa-up-right-and-down-left-from-center text-cyan-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">UPSCALE</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 flex items-center justify-between">
            <span>Scale Factor</span>
            <span className="text-white/60">{d.scale}x</span>
          </label>
          <div className="flex gap-1.5">
            {[2, 4].map((s) => (
              <button
                key={s}
                onClick={() => updateNodeData(id, { scale: s })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${d.scale === s
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
                  }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={d.isRunning}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Upscaling...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Upscale
            </>
          )}
        </button>

        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{d.error}</div>
        )}

        {d.outputImage && (
          <img src={d.outputImage} alt="Upscaled" className="w-full rounded-lg border border-white/5" />
        )}
      </div>
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(UpscaleNode);
