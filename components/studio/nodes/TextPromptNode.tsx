'use client';

import { memo, useCallback, useState } from 'react';
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
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const d = data as { prompt: string; style: string; label: string; lockToImage?: boolean };

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState('');

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

  const toggleLockToImage = useCallback(() => {
    updateNodeData(id, { lockToImage: !d.lockToImage });
  }, [id, d.lockToImage, updateNodeData]);

  // ── Enhance Prompt ──────────────────────────────────────────────
  const handleEnhance = useCallback(async () => {
    const currentPrompt = d.prompt?.trim();
    if (!currentPrompt) return;

    setIsEnhancing(true);
    setOriginalPrompt(currentPrompt);

    try {
      // Check if there's an upstream image for context
      const upstream = getUpstreamData(id);
      const hasUpstreamImage = !!upstream.imageUrl;

      const body: Record<string, unknown> = {
        prompt: currentPrompt,
        lockToImage: !!d.lockToImage,
      };

      // If locked to image and image is available, add a description hint
      if (d.lockToImage && hasUpstreamImage) {
        body.imageDescription = `The user has uploaded a product/subject image. The prompt should keep the subject identical and only vary backgrounds, angles, lighting, and staging.`;
      }

      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Enhancement failed');
      }

      const result = await res.json();
      updateNodeData(id, { prompt: result.enhancedPrompt });
      setShowOriginal(true);
    } catch (err) {
      // silent fail — user can try again
      console.error('Enhance failed:', err);
    } finally {
      setIsEnhancing(false);
    }
  }, [d.prompt, d.lockToImage, id, getUpstreamData, updateNodeData]);

  // Revert to original
  const handleRevert = useCallback(() => {
    if (originalPrompt) {
      updateNodeData(id, { prompt: originalPrompt });
      setShowOriginal(false);
      setOriginalPrompt('');
    }
  }, [originalPrompt, id, updateNodeData]);

  return (
    <div className="relative w-[380px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-violet-600/20 to-purple-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center">
          <i className="fa-solid fa-pen-fancy text-violet-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">TEXT PROMPT</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Prompt textarea */}
        <textarea
          value={d.prompt || ''}
          onChange={onPromptChange}
          placeholder={d.lockToImage
            ? "Describe the variation... (product stays the same, backgrounds/angles change)"
            : "Describe what you want to create..."
          }
          rows={4}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 placeholder:text-white/30 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
        />

        {/* Action buttons row */}
        <div className="flex gap-1.5">
          {/* Enhance Prompt button */}
          <button
            onClick={handleEnhance}
            disabled={isEnhancing || !d.prompt?.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all bg-gradient-to-r from-violet-600/30 to-purple-600/30 text-violet-300 border border-violet-500/20 hover:border-violet-500/40 hover:from-violet-600/40 hover:to-purple-600/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEnhancing ? (
              <>
                <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                Enhancing...
              </>
            ) : (
              <>
                <i className="fa-solid fa-wand-magic-sparkles text-[9px]"></i>
                Enhance with AI
              </>
            )}
          </button>

          {/* Revert button (shown after enhance) */}
          {showOriginal && (
            <button
              onClick={handleRevert}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
              title="Revert to original prompt"
            >
              <i className="fa-solid fa-rotate-left text-[9px]"></i>
              Undo
            </button>
          )}
        </div>

        {/* Lock to Image toggle */}
        <div
          onClick={toggleLockToImage}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
            d.lockToImage
              ? 'bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15'
              : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
          }`}
        >
          {/* Toggle switch */}
          <div className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
            d.lockToImage ? 'bg-amber-500/60' : 'bg-white/15'
          }`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
              d.lockToImage ? 'left-[18px] bg-amber-300' : 'left-0.5 bg-white/40'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <i className={`fa-solid fa-lock text-[9px] ${d.lockToImage ? 'text-amber-400' : 'text-white/30'}`}></i>
              <span className={`text-[11px] font-medium ${d.lockToImage ? 'text-amber-300' : 'text-white/50'}`}>
                Lock to Image
              </span>
            </div>
            <p className={`text-[9px] mt-0.5 leading-tight ${d.lockToImage ? 'text-amber-400/60' : 'text-white/25'}`}>
              {d.lockToImage
                ? 'Product stays fixed — only backgrounds, angles & lighting change'
                : 'Enable to keep your subject fixed while varying surroundings'
              }
            </p>
          </div>
        </div>

        {/* Style selector */}
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
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(TextPromptNode);
