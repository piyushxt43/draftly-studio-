'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

function RemoveBGNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const d = data as {
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
      const res = await fetch('/api/studio/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId || undefined, imageUrl: upstream.imageUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Background removal failed');
      }

      const result = await res.json();
      updateNodeData(id, { outputImage: result.image, isRunning: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, currentUserId, getUpstreamData, updateNodeData]);

  return (
    <div className="relative w-[360px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-lime-600/20 to-green-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-lime-500/20 flex items-center justify-center">
          <i className="fa-solid fa-eraser text-lime-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">REMOVE BG</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        <p className="text-[10px] text-white/40">
          Removes the background from an input image using AI segmentation.
        </p>

        <button
          onClick={handleRun}
          disabled={d.isRunning}
          className="w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-lime-600 hover:bg-lime-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Removing...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Remove Background
            </>
          )}
        </button>

        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{d.error}</div>
        )}

        {d.outputImage && (
          <div className="relative">
            {/* Checkerboard background to show transparency */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                backgroundImage: `linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)`,
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
              }}
            />
            <img src={d.outputImage} alt="Background removed" className="relative w-full rounded-lg" />
          </div>
        )}
      </div>
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(RemoveBGNode);
