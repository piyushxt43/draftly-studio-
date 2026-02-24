'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

function PreviewNode({ id, data }: NodeProps) {
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const updateNodeData = useStudioStore((s) => s.updateNodeData);

  const d = data as {
    mediaUrl: string | null;
    mediaType: 'image' | 'video' | null;
    label: string;
  };

  const handleRefresh = useCallback(() => {
    const upstream = getUpstreamData(id);
    if (upstream.imageUrl) {
      updateNodeData(id, { mediaUrl: upstream.imageUrl, mediaType: 'image' });
    }
  }, [id, getUpstreamData, updateNodeData]);

  const handleDownload = useCallback(async () => {
    if (!d.mediaUrl) return;
    try {
      const response = await fetch(d.mediaUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.mediaType === 'video' ? 'studio-output.mp4' : 'studio-output.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // For data URLs, open directly
      const a = document.createElement('a');
      a.href = d.mediaUrl;
      a.download = d.mediaType === 'video' ? 'studio-output.mp4' : 'studio-output.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [d.mediaUrl, d.mediaType]);

  return (
    <div className="relative w-[320px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-white/10 to-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
            <i className="fa-solid fa-eye text-white/70 text-xs"></i>
          </div>
          <span className="text-xs font-semibold text-white/90 tracking-wide">PREVIEW</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
            title="Refresh from upstream"
          >
            <i className="fa-solid fa-refresh text-white/50 text-[10px]"></i>
          </button>
          {d.mediaUrl && (
            <button
              onClick={handleDownload}
              className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
              title="Download"
            >
              <i className="fa-solid fa-download text-white/50 text-[10px]"></i>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {d.mediaUrl ? (
          <div className="rounded-lg overflow-hidden border border-white/5">
            {d.mediaType === 'video' ? (
              <video src={d.mediaUrl} controls autoPlay loop muted className="w-full" />
            ) : (
              <img src={d.mediaUrl} alt="Preview output" className="w-full" />
            )}
          </div>
        ) : (
          <div className="w-full h-40 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-2">
            <i className="fa-solid fa-eye-slash text-white/20 text-xl"></i>
            <span className="text-xs text-white/30">Connect a node and click refresh</span>
          </div>
        )}
      </div>
      </div>

      <Handle type="target" position={Position.Left} />
    </div>
  );
}

export default memo(PreviewNode);
