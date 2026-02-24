'use client';

import { useStudioStore } from '@/lib/studio-store';

export default function OutputPanel() {
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId);
  const nodes = useStudioStore((s) => s.nodes);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  if (!selectedNode) {
    return (
      <div className="w-72 bg-[#0a0a0a] border-l border-white/5 flex flex-col items-center justify-center p-6">
        <i className="fa-solid fa-hand-pointer text-white/10 text-3xl mb-3"></i>
        <p className="text-xs text-white/30 text-center">
          Select a node to view its details and output
        </p>
      </div>
    );
  }

  const d = selectedNode.data as Record<string, unknown>;

  // Collect all output media from the selected node
  const images: string[] = [];
  const videos: string[] = [];

  if (d.outputImages && Array.isArray(d.outputImages)) {
    images.push(...(d.outputImages as string[]));
  }
  if (d.outputImage && typeof d.outputImage === 'string') {
    images.push(d.outputImage);
  }
  if (d.imageUrl && typeof d.imageUrl === 'string') {
    images.push(d.imageUrl);
  }
  if (d.outputUrl && typeof d.outputUrl === 'string') {
    videos.push(d.outputUrl);
  }
  if (d.mediaUrl && typeof d.mediaUrl === 'string') {
    if (d.mediaType === 'video') {
      videos.push(d.mediaUrl);
    } else {
      images.push(d.mediaUrl);
    }
  }

  return (
    <div className="w-72 bg-[#0a0a0a] border-l border-white/5 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-wider">
          {String(d.label || selectedNode.type || 'Node')}
        </h2>
        <p className="text-[10px] text-white/30 mt-0.5">
          Node: {selectedNode.id.split('-').slice(0, 2).join('-')}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Node info */}
        <div className="space-y-2">
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Properties</div>
          {d.prompt !== undefined && (
            <div>
              <span className="text-[10px] text-white/30">Prompt:</span>
              <p className="text-xs text-white/70 mt-0.5 line-clamp-4">{String(d.prompt) || '(empty)'}</p>
            </div>
          )}
          {d.style !== undefined && (
            <div>
              <span className="text-[10px] text-white/30">Style:</span>
              <p className="text-xs text-white/70 mt-0.5">{String(d.style)}</p>
            </div>
          )}
          {d.model !== undefined && (
            <div>
              <span className="text-[10px] text-white/30">Model:</span>
              <p className="text-xs text-white/70 mt-0.5">{String(d.model)}</p>
            </div>
          )}
          {d.isRunning !== undefined && (
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${d.isRunning ? 'bg-yellow-400 animate-pulse' : d.error ? 'bg-red-400' : images.length || videos.length ? 'bg-green-400' : 'bg-white/20'}`} />
              <span className="text-[10px] text-white/50">
                {d.isRunning ? 'Running...' : d.error ? 'Error' : images.length || videos.length ? 'Complete' : 'Ready'}
              </span>
            </div>
          )}
        </div>

        {/* Output media */}
        {(images.length > 0 || videos.length > 0) && (
          <div className="space-y-3">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Output</div>
            {images.map((url, i) => (
              <div key={i} className="space-y-1.5">
                <img src={url} alt={`Output ${i + 1}`} className="w-full rounded-lg border border-white/10" />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      if (url.startsWith('data:')) {
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `draftly-output-${Date.now()}-${i}.png`;
                        link.click();
                      } else {
                        window.open(url, '_blank');
                      }
                    }}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 bg-violet-600/20 text-violet-300 hover:bg-violet-600/40 border border-violet-500/20"
                  >
                    <i className="fa-solid fa-download text-[9px]"></i>
                    Download
                  </button>
                  <button
                    onClick={() => window.open(url, '_blank')}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] transition-all flex items-center justify-center bg-white/5 text-white/40 hover:bg-white/10 border border-white/5"
                    title="Fullscreen"
                  >
                    <i className="fa-solid fa-expand text-[9px]"></i>
                  </button>
                </div>
              </div>
            ))}
            {videos.map((url, i) => (
              <div key={i} className="space-y-1.5">
                <video src={url} controls autoPlay loop muted className="w-full rounded-lg border border-white/10" />
                <a
                  href={url}
                  download={`draftly-video-${Date.now()}-${i}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1.5 bg-rose-600/20 text-rose-300 hover:bg-rose-600/40 border border-rose-500/20"
                >
                  <i className="fa-solid fa-download text-[9px]"></i>
                  Download Video
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!!d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {String(d.error)}
          </div>
        )}
      </div>
    </div>
  );
}
