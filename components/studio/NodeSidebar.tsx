'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStudioStore } from '@/lib/studio-store';

const NODE_CATEGORIES = [
  {
    title: 'Input',
    nodes: [
      {
        type: 'textPrompt',
        label: 'Text Prompt',
        icon: 'fa-pen-fancy',
        color: 'violet',
        desc: 'Enter a creative prompt',
      },
      {
        type: 'imageUpload',
        label: 'Image Upload',
        icon: 'fa-image',
        color: 'emerald',
        desc: 'Upload a reference image',
      },
    ],
  },
  {
    title: 'Generate',
    nodes: [
      {
        type: 'imageGen',
        label: 'Image Gen',
        icon: 'fa-wand-magic-sparkles',
        color: 'blue',
        desc: 'Text to image generation',
      },
      {
        type: 'imageVariation',
        label: 'Variation',
        icon: 'fa-shuffle',
        color: 'orange',
        desc: 'Create image variations',
      },
      {
        type: 'videoGen',
        label: 'Video Gen',
        icon: 'fa-film',
        color: 'rose',
        desc: 'Image/text to video',
      },
    ],
  },
  {
    title: 'Process',
    nodes: [
      {
        type: 'upscale',
        label: 'Upscale',
        icon: 'fa-up-right-and-down-left-from-center',
        color: 'cyan',
        desc: 'Upscale image 2x-4x',
      },
      {
        type: 'removeBG',
        label: 'Remove BG',
        icon: 'fa-eraser',
        color: 'lime',
        desc: 'Remove image background',
      },
    ],
  },
  {
    title: 'Output',
    nodes: [
      {
        type: 'preview',
        label: 'Preview',
        icon: 'fa-eye',
        color: 'white',
        desc: 'Preview & download output',
      },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30',
  emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30',
  lime: 'bg-lime-500/20 text-lime-400 border-lime-500/30 hover:bg-lime-500/30',
  white: 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20',
};

const ICON_COLOR_MAP: Record<string, string> = {
  violet: 'bg-violet-500/30 text-violet-400',
  emerald: 'bg-emerald-500/30 text-emerald-400',
  blue: 'bg-blue-500/30 text-blue-400',
  orange: 'bg-orange-500/30 text-orange-400',
  rose: 'bg-rose-500/30 text-rose-400',
  cyan: 'bg-cyan-500/30 text-cyan-400',
  lime: 'bg-lime-500/30 text-lime-400',
  white: 'bg-white/20 text-white/70',
};

function LocalServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [details, setDetails] = useState<{ device?: string; image_model_loaded?: boolean; video_model_loaded?: boolean; ltx_configured?: boolean }>({});

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
    const interval = setInterval(check, 15000); // Re-check every 15s
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
          <div className="text-[9px] text-white/30">
            Image: {details.image_model_loaded ? 'Loaded' : 'Ready (loads on first use)'}
          </div>
          <div className="text-[9px] text-white/30">
            Video: {details.ltx_configured ? (details.video_model_loaded ? 'LTX-2 Loaded' : 'LTX-2 Ready') : 'Not configured'}
          </div>
        </div>
      )}
      {status === 'offline' && (
        <p className="text-[9px] text-white/20 mt-1">
          Run: cd local-server &amp;&amp; python server.py
        </p>
      )}
    </div>
  );
}

export default function NodeSidebar() {
  const addNode = useStudioStore((s) => s.addNode);

  // OSS mode: static labels (no hosted account/subscription dependency)
  const planName: string = 'oss';
  const creditsUsed = 0;
  const creditsTotal = 0;
  const creditsRemaining = 0;
  const usagePercent = 0;

  const handleAddNode = useCallback(
    (type: string) => {
      // Add node at a slightly randomized center position
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
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <h2 className="text-xs font-bold text-white/80 uppercase tracking-wider">Nodes</h2>
        <p className="text-[10px] text-white/30 mt-0.5 hidden md:block">Drag or click to add</p>
        <p className="text-[10px] text-white/30 mt-0.5 md:hidden">Tap to add to canvas</p>
      </div>

      {/* Node list */}
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
      {/* Local server status */}
      <LocalServerStatus />

      {/* Credit-based usage indicator */}
      <div className="px-3 py-3 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
            Credits
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            planName === 'pro' ? 'bg-violet-500/20 text-violet-400' :
            planName === 'premium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-white/10 text-white/40'
          }`}>
            {planName.toUpperCase()}
          </span>
        </div>
        {/* Credits bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-white/50">{creditsRemaining} remaining</span>
            <span className="text-white/30">{creditsUsed}/{creditsTotal}</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePercent > 80 ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                usagePercent > 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                'bg-gradient-to-r from-blue-500 to-cyan-500'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
        {/* Credit info */}
        <div className="text-[9px] text-white/20 space-y-0.5">
          <div className="flex justify-between">
            <span>1 Nano Banana image</span>
            <span>5 credits</span>
          </div>
          <div className="flex justify-between">
            <span>1s video</span>
            <span>6 credits</span>
          </div>
        </div>
        <div className="w-full py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <i className="fa-solid fa-laptop-code text-[9px]"></i>
          OSS Mode — bring your own keys
        </div>
      </div>
    </div>
  );
}
