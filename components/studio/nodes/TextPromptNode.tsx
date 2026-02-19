'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

const STYLE_OPTIONS = [
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'anime', label: 'Anime' },
  { value: '3d-render', label: '3D Render' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'oil-painting', label: 'Oil Painting' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'pixel-art', label: 'Pixel Art' },
  { value: 'concept-art', label: 'Concept Art' },
  { value: 'none', label: 'No Style' },
];

function TextPromptNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const d = data as { prompt: string; style: string; label: string };

  const onPromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateNodeData(id, { prompt: e.target.value });
    },
    [id, updateNodeData],
  );

  const onStyleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { style: e.target.value });
    },
    [id, updateNodeData],
  );

  return (
    <div className="bg-[#141414] border border-white/10 rounded-xl w-[380px] shadow-2xl overflow-hidden">
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-violet-600/20 to-purple-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
          <i className="fa-solid fa-pen-fancy text-violet-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">TEXT PROMPT</span>
      </div>

      <div className="p-3 space-y-3">
        <textarea
          value={d.prompt || ''}
          onChange={onPromptChange}
          placeholder="Describe what you want to create..."
          rows={4}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
        />

        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">
            Style
          </label>
          <select
            value={d.style || 'photorealistic'}
            onChange={onStyleChange}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-violet-500/50 transition-all appearance-none cursor-pointer"
          >
            {STYLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {d.prompt && (
          <div className="text-[10px] text-white/30 truncate">
            {d.prompt.length} characters
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(TextPromptNode);
