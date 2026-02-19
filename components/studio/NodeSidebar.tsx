'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStudioStore } from '@/lib/studio-store';

const NODE_CATEGORIES = [
  {
    title: 'Input',
    nodes: [
      { type: 'textPrompt', label: 'Text Prompt', icon: 'fa-pen-fancy', color: 'violet', desc: 'Enter a creative prompt' },
      { type: 'imageUpload', label: 'Image Upload', icon: 'fa-image', color: 'emerald', desc: 'Upload a reference image' },
    ],
  },
  {
    title: 'Generate',
    nodes: [
      { type: 'imageGen', label: 'Image Gen', icon: 'fa-wand-magic-sparkles', color: 'blue', desc: 'Local SD 1.5 image gen' },
      { type: 'videoGen', label: 'Video Gen', icon: 'fa-film', color: 'rose', desc: 'Local AnimateDiff video' },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30',
};

const ICON_COLOR_MAP: Record<string, string> = {
  violet: 'bg-violet-500/30 text-violet-400',
  emerald: 'bg-emerald-500/30 text-emerald-400',
  blue: 'bg-blue-500/30 text-blue-400',
  rose: 'bg-rose-500/30 text-rose-400',
};

function LocalServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [details, setDetails] = useState<{ device?: string; gpu?: string; image_model_loaded?: boolean; video_model_loaded?: boolean }>({});

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/studio/local-status');
        const data = await res.json();
        if (data.running) {
          setStatus('online');
          setDetails(data);
        } else {
          setStatus('offline');
        }
      } catch {
        setStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-3 py-2.5 border-t border-white/5">
      <div className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-1.5">
        Local AI Server
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-400' : status === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'}`} />
        <span className={`text-[10px] font-medium ${status === 'online' ? 'text-green-400' : status === 'offline' ? 'text-red-400' : 'text-yellow-400'}`}>
          {status === 'online' ? `Online (${details.device || 'cpu'})` : status === 'offline' ? 'Offline' : 'Checking...'}
        </span>
      </div>
      {status === 'online' && (
        <div className="mt-1 space-y-0.5">
          {details.gpu && <div className="text-[9px] text-white/30">GPU: {details.gpu}</div>}
          <div className="text-[9px] text-white/30">
            Image: {details.image_model_loaded ? 'SD 1.5 Loaded' : 'Ready (loads on first use)'}
          </div>
          <div className="text-[9px] text-white/30">
            Video: {details.video_model_loaded ? 'AnimateDiff Loaded' : 'Ready (loads on first use)'}
          </div>
        </div>
      )}
      {status === 'offline' && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[9px] text-white/20">
            Start the server:
          </p>
          <code className="text-[9px] font-mono text-emerald-400/60 bg-emerald-500/[0.06] px-2 py-1 rounded border border-emerald-500/10 block">
            cd local-server && python server.py
          </code>
        </div>
      )}
    </div>
  );
}

export default function NodeSidebar() {
  const addNode = useStudioStore((s) => s.addNode);

  const handleAddNode = useCallback(
    (type: string) => {
      const x = 200 + Math.random() * 200;
      const y = 100 + Math.random() * 200;
      addNode(type, { x, y });
    },
    [addNode],
  );

  const onDragStart = useCallback((e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="w-56 bg-[#0a0a0a] border-r border-white/5 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-wider">Nodes</h2>
        <p className="text-[10px] text-white/30 mt-0.5">Drag or click to add</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {NODE_CATEGORIES.map((cat) => (
          <div key={cat.title}>
            <h3 className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2 px-1">
              {cat.title}
            </h3>
            <div className="space-y-1.5">
              {cat.nodes.map((node) => (
                <div
                  key={node.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                  onClick={() => handleAddNode(node.type)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${COLOR_MAP[node.color]}`}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ICON_COLOR_MAP[node.color]}`}>
                    <i className={`fa-solid ${node.icon} text-xs`}></i>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white/80 truncate">{node.label}</div>
                    <div className="text-[9px] text-white/30 truncate">{node.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <LocalServerStatus />

      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium">100% Local — Free & Unlimited</span>
        </div>
        <p className="text-[9px] text-white/20 mt-2 px-1">
          All processing runs on your GPU. No API costs, no limits, no data leaves your machine.
        </p>
      </div>
    </div>
  );
}
