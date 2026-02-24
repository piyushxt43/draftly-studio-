'use client';

import { memo, useCallback, useMemo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';
import { compressImagesForApi } from '@/lib/image-utils';

// Model options — Nano Banana Pro is the only free model, others locked behind Pro ($60)
const MODEL_OPTIONS = [
  { value: 'nano-banana-pro', label: 'Nano Banana Pro', provider: 'api-easy', speed: 'Best', credits: 5, locked: false },
  { value: 'flux-schnell', label: 'Flux Schnell', provider: 'fal', speed: 'Fast', credits: 3, locked: true },
  { value: 'flux-dev', label: 'Flux Dev', provider: 'fal', speed: 'Quality', credits: 3, locked: true },
  { value: 'flux-pro', label: 'Flux Pro 1.1', provider: 'fal', speed: 'HD', credits: 4, locked: true },
  { value: 'fooocus', label: 'Fooocus', provider: 'fal', speed: 'Creative', credits: 3, locked: true },
  { value: 'stable-cascade', label: 'Stable Cascade', provider: 'fal', speed: 'Quality', credits: 3, locked: true },
  { value: 'sdxl-turbo', label: 'SDXL Turbo', provider: 'fal', speed: 'Ultra Fast', credits: 2, locked: true },
  { value: 'playground-v25', label: 'Playground v2.5', provider: 'fal', speed: 'Creative', credits: 2, locked: true },
  { value: 'juggernaut-xl', label: 'Juggernaut XL', provider: 'fal', speed: 'Photo', credits: 4, locked: true },
  { value: 'realvis-xl-v4', label: 'RealVisXL v4', provider: 'fal', speed: 'Photo', credits: 4, locked: true },
  { value: 'dreamshaper-xl', label: 'DreamShaper XL', provider: 'fal', speed: 'Versatile', credits: 2, locked: true },
  { value: 'local-sd15', label: 'Local SD 1.5 (Free)', provider: 'local', speed: 'GPU', credits: 0, locked: false },
];

const ASPECT_RATIOS = [
  { value: 'auto', label: 'Auto' },
  { value: '1:1', label: '1:1 Square' },
  { value: '16:9', label: '16:9 Wide' },
  { value: '9:16', label: '9:16 Tall' },
  { value: '4:3', label: '4:3 Standard' },
  { value: '3:4', label: '3:4 Portrait' },
];

const RESOLUTION_OPTIONS = [
  { value: '1K', label: '1K (1024px)', locked: false, creditMultiplier: 1 },
  { value: '4K', label: '4K (4096px)', locked: true, creditMultiplier: 2 },
];

function ImageGenNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const d = data as {
    model: string;
    aspectRatio: string;
    resolution: string;
    numOutputs: number;
    guidanceScale: number;
    outputImages: string[];
    isRunning: boolean;
    error: string | null;
  };

  const selectedModelDef = useMemo(() => MODEL_OPTIONS.find((m) => m.value === d.model), [d.model]);
  const selectedRes = useMemo(() => RESOLUTION_OPTIONS.find((r) => r.value === (d.resolution || '1K')), [d.resolution]);

  // Calculate credits including resolution multiplier
  const displayCredits = useMemo(() => {
    const base = selectedModelDef?.credits || 5;
    const multiplier = selectedRes?.creditMultiplier || 1;
    return base * multiplier;
  }, [selectedModelDef, selectedRes]);

  const upstreamInfo = useMemo(() => {
    const upstream = getUpstreamData(id);
    return {
      hasPrompt: !!upstream.prompt,
      hasImage: !!upstream.imageUrl,
      imageCount: upstream.imageUrls.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, getUpstreamData]);

  // Get userId from store for credit billing
  const currentUserId = useStudioStore((s) => s.currentUserId);

  const handleRun = useCallback(async () => {
    const upstream = getUpstreamData(id);
    if (!upstream.prompt && !upstream.imageUrl) {
      updateNodeData(id, { error: 'Connect a Text Prompt or Image Upload node first' });
      return;
    }

    // Check if model is locked
    const model = MODEL_OPTIONS.find((m) => m.value === d.model);
    if (model?.locked) {
      updateNodeData(id, { error: 'This model requires the Pro plan ($60/mo). Upgrade to unlock all models.' });
      return;
    }

    // Check resolution lock
    const res = RESOLUTION_OPTIONS.find((r) => r.value === (d.resolution || '1K'));
    if (res?.locked) {
      updateNodeData(id, { error: '4K resolution requires Pro ($60) or Premium ($200) plan.' });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, outputImages: [] });

    try {
      // Determine actual aspect ratio — "auto" means detect from upstream image
      let finalAspectRatio = d.aspectRatio || '1:1';
      if (finalAspectRatio === 'auto' && upstream.imageUrl) {
        // Try to detect aspect ratio from the uploaded image
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = upstream.imageUrl!;
          });
          const w = loaded.naturalWidth;
          const h = loaded.naturalHeight;
          const ratio = w / h;
          if (ratio > 1.6) finalAspectRatio = '16:9';
          else if (ratio > 1.2) finalAspectRatio = '4:3';
          else if (ratio > 0.85) finalAspectRatio = '1:1';
          else if (ratio > 0.65) finalAspectRatio = '3:4';
          else finalAspectRatio = '9:16';
        } catch {
          finalAspectRatio = '1:1'; // fallback
        }
      } else if (finalAspectRatio === 'auto') {
        finalAspectRatio = '1:1';
      }

      // Compress base64 images before sending to avoid body size limits
      const compressedImages = upstream.imageUrls.length > 0
        ? await compressImagesForApi(upstream.imageUrls)
        : [];

      const selectedModel = MODEL_OPTIONS.find((m) => m.value === d.model) || MODEL_OPTIONS[0];
      const fetchRes = await fetch('/api/studio/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId || undefined,
          prompt: upstream.prompt || '',
          style: upstream.style || 'photorealistic',
          model: d.model,
          provider: selectedModel.provider,
          aspectRatio: finalAspectRatio,
          numOutputs: d.numOutputs,
          guidanceScale: d.guidanceScale,
          inputImage: compressedImages[0] || null,
          inputImages: compressedImages.length > 0 ? compressedImages : null,
          resolution: d.resolution || '1K',
        }),
      });

      if (!fetchRes.ok) {
        let errMsg = 'Generation failed';
        try {
          const err = await fetchRes.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await fetchRes.text().catch(() => '');
          if (text.includes('Request Entity Too Large') || fetchRes.status === 413) {
            errMsg = 'Images too large. Try using smaller images or fewer connections.';
          } else {
            errMsg = `Server error (${fetchRes.status})`;
          }
        }
        throw new Error(errMsg);
      }

      const result = await fetchRes.json();
      updateNodeData(id, { outputImages: result.images, isRunning: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, d.model, d.aspectRatio, d.resolution, d.numOutputs, d.guidanceScale, currentUserId, getUpstreamData, updateNodeData]);

  // Batch trigger
  const batchImageTrigger = useStudioStore((s) => s.batchImageTrigger);
  const prevBatchRef = useRef(batchImageTrigger);
  useEffect(() => {
    if (batchImageTrigger > 0 && batchImageTrigger !== prevBatchRef.current) {
      prevBatchRef.current = batchImageTrigger;
      if (!d.isRunning) {
        handleRun();
      }
    }
  }, [batchImageTrigger, d.isRunning, handleRun]);

  return (
    <div className="relative w-[400px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
          <i className="fa-solid fa-wand-magic-sparkles text-blue-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">IMAGE GENERATION</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        {/* Input status */}
        <div className="flex items-center gap-2 text-[10px]">
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${upstreamInfo.hasPrompt ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'}`}>
            <i className="fa-solid fa-pen-fancy text-[8px]"></i>
            Text
          </div>
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${upstreamInfo.hasImage ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/20'}`}>
            <i className="fa-solid fa-image text-[8px]"></i>
            {upstreamInfo.imageCount > 1
              ? `${upstreamInfo.imageCount} Images (editing)`
              : upstreamInfo.hasImage
                ? 'Image (editing)'
                : 'Image'}
          </div>
        </div>

        {/* Model selector with lock icons */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 flex items-center justify-between">
            <span>Model</span>
            {displayCredits > 0 && (
              <span className="text-[9px] text-blue-300/60">{displayCredits} credits</span>
            )}
          </label>
          <select
            value={d.model}
            onChange={(e) => updateNodeData(id, { model: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#1a1a1a]">
                {m.locked ? '🔒 ' : ''}{m.label} — {m.speed} ({m.credits}cr){m.locked ? ' [Pro $60/mo]' : ''}
              </option>
            ))}
          </select>

          {/* Lock warning */}
          {selectedModelDef?.locked && (
            <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <i className="fa-solid fa-lock text-[9px] text-amber-400"></i>
              <span className="text-[10px] text-amber-400">Requires Pro plan ($60/mo) to use</span>
            </div>
          )}
        </div>

        {/* Aspect ratio */}
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
                    ? ar.value === 'auto'
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                    : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
                }`}
              >
                {ar.value === 'auto' && <i className="fa-solid fa-crop-simple text-[8px] mr-1"></i>}
                {ar.label}
              </button>
            ))}
          </div>
          {(d.aspectRatio === 'auto') && (
            <p className="text-[9px] text-emerald-400/50 mt-1">Matches uploaded image ratio automatically</p>
          )}
        </div>

        {/* Resolution */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 block">
            Resolution
          </label>
          <div className="flex gap-1.5">
            {RESOLUTION_OPTIONS.map((res) => (
              <button
                key={res.value}
                onClick={() => !res.locked && updateNodeData(id, { resolution: res.value })}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
                  (d.resolution || '1K') === res.value
                    ? res.locked
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                    : res.locked
                      ? 'bg-white/[0.02] text-white/30 border border-white/5 cursor-not-allowed'
                      : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
                }`}
              >
                {res.locked && <i className="fa-solid fa-lock text-[8px]"></i>}
                {res.label}
                {res.creditMultiplier > 1 && (
                  <span className="text-[8px] opacity-60">(2x cr)</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Local badge */}
        {(MODEL_OPTIONS.find((m) => m.value === d.model)?.provider === 'local') && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">LOCAL GPU — Free, no API cost</span>
          </div>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={d.isRunning || (selectedModelDef?.locked ?? false)}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedModelDef?.locked
              ? 'bg-amber-600/20 text-amber-300 border border-amber-500/20'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Generating...
            </>
          ) : selectedModelDef?.locked ? (
            <>
              <i className="fa-solid fa-lock text-xs"></i>
              Upgrade to Pro
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Generate
            </>
          )}
        </button>

        {/* Error */}
        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {d.error}
          </div>
        )}

        {/* Output images */}
        {d.outputImages?.length > 0 && (
          <div className="space-y-2">
            {d.outputImages.map((url: string, i: number) => (
              <div key={i} className="space-y-1.5">
                <div className="relative group rounded-lg overflow-hidden border border-white/10">
                  <img src={url} alt={`Generated ${i + 1}`} className="w-full object-cover" />
                </div>
                <div className="flex gap-1.5">
                  <button
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-500/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (url.startsWith('data:')) {
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `draftly-image-${Date.now()}-${i}.png`;
                        link.click();
                      } else {
                        window.open(url, '_blank');
                      }
                    }}
                  >
                    <i className="fa-solid fa-download text-[10px]"></i>
                    Download
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center bg-white/5 text-white/50 hover:bg-white/10 border border-white/5"
                    title="Open fullscreen"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(url, '_blank');
                    }}
                  >
                    <i className="fa-solid fa-expand text-[10px]"></i>
                  </button>
                </div>
              </div>
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

export default memo(ImageGenNode);
