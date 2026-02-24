'use client';

import { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';
import { compressImagesForApi } from '@/lib/image-utils';

// Video models — Veo first (best quality), then fal.ai
// variableDuration: whether the model supports user-chosen duration
// fixedDuration: the fixed output length when not variable
const MODEL_OPTIONS = [
  { value: 'veo-3.0-fast', label: 'Veo 3.0 Fast', provider: 'api-easy', creditsPerSec: 6, locked: false, variableDuration: false, fixedDuration: 8 },
  { value: 'veo-3.0', label: 'Veo 3.0 (Best)', provider: 'api-easy', creditsPerSec: 12, locked: true, variableDuration: false, fixedDuration: 8 },
  { value: 'wan-video', label: 'WAN Video', provider: 'fal', creditsPerSec: 6, locked: true, variableDuration: false, fixedDuration: 4 },
  { value: 'kling-1.6', label: 'Kling 1.6', provider: 'fal', creditsPerSec: 6, locked: true, variableDuration: true, fixedDuration: 5 },
  { value: 'kling-1.6-pro', label: 'Kling 1.6 Pro', provider: 'fal', creditsPerSec: 6, locked: true, variableDuration: true, fixedDuration: 5 },
  { value: 'minimax-video-fal', label: 'Minimax Video', provider: 'fal', creditsPerSec: 6, locked: true, variableDuration: false, fixedDuration: 6 },
  { value: 'luma-dream-machine', label: 'Luma Dream Machine', provider: 'fal', creditsPerSec: 6, locked: true, variableDuration: false, fixedDuration: 5 },
  { value: 'hunyuan-video', label: 'Hunyuan Video', provider: 'fal', creditsPerSec: 6, locked: true, variableDuration: false, fixedDuration: 4 },
  { value: 'local-animatediff', label: 'Local AnimateDiff (Free)', provider: 'local', creditsPerSec: 0, locked: false, variableDuration: false, fixedDuration: 2 },
];

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 Wide' },
  { value: '9:16', label: '9:16 Tall' },
  { value: '1:1', label: '1:1 Square' },
  { value: '4:3', label: '4:3 Standard' },
];

const RESOLUTION_OPTIONS = [
  { value: '1K', label: '1K (720p)', locked: false, creditMultiplier: 1 },
  { value: '4K', label: '4K (2160p)', locked: true, creditMultiplier: 2 },
];

function VideoGenNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const getUpstreamData = useStudioStore((s) => s.getUpstreamData);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  const d = data as {
    model: string;
    duration: number;
    aspectRatio: string;
    resolution: string;
    outputUrl: string | null;
    jobId: string | null;
    isRunning: boolean;
    progress: number;
    error: string | null;
  };

  const selectedModelDef = useMemo(() => MODEL_OPTIONS.find((m) => m.value === d.model), [d.model]);
  const selectedRes = useMemo(() => RESOLUTION_OPTIONS.find((r) => r.value === (d.resolution || '1K')), [d.resolution]);

  // Use the model's fixed duration when it doesn't support variable duration
  const effectiveDuration = useMemo(() => {
    if (!selectedModelDef) return d.duration;
    return selectedModelDef.variableDuration ? d.duration : selectedModelDef.fixedDuration;
  }, [d.duration, selectedModelDef]);

  const estimatedCredits = useMemo(() => {
    const perSec = selectedModelDef?.creditsPerSec || 6;
    const multiplier = selectedRes?.creditMultiplier || 1;
    return Math.ceil(effectiveDuration * perSec * multiplier);
  }, [effectiveDuration, selectedModelDef, selectedRes]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollStatus = useCallback(
    async (jobId: string, provider: string, modelName: string) => {
      pollCountRef.current = 0;
      let networkErrorCount = 0;
      pollingRef.current = setInterval(async () => {
        try {
          pollCountRef.current += 1;
          const res = await fetch(
            `/api/studio/poll-status?jobId=${encodeURIComponent(jobId)}&provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(modelName)}`,
          );

          if (!res.ok) {
            networkErrorCount += 1;
            if (networkErrorCount >= 5) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              updateNodeData(id, {
                isRunning: false,
                error: `Poll failed after ${networkErrorCount} retries (HTTP ${res.status})`,
                jobId: null,
              });
            }
            return;
          }

          networkErrorCount = 0; // reset on success
          let result;
          try {
            result = await res.json();
          } catch {
            return; // skip this poll if response isn't valid JSON
          }

          if (result.status === 'completed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (result.outputUrl) {
              updateNodeData(id, {
                outputUrl: result.outputUrl,
                isRunning: false,
                progress: 100,
                jobId: null,
              });
            } else {
              updateNodeData(id, {
                isRunning: false,
                error: 'Video completed but no URL returned. Try generating again.',
                jobId: null,
              });
            }
          } else if (result.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            updateNodeData(id, {
              isRunning: false,
              error: result.error || 'Video generation failed',
              jobId: null,
            });
          } else {
            // Still processing — use server progress if available, else increment smoothly
            const serverProgress = result.progress;
            const estimatedProgress = Math.min(5 + pollCountRef.current * 4, 95);
            updateNodeData(id, {
              progress: serverProgress ?? estimatedProgress,
            });
          }

          // Safety timeout — stop polling after 5 minutes
          if (pollCountRef.current > 75) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            updateNodeData(id, {
              isRunning: false,
              error: 'Video generation timed out. Try again.',
              jobId: null,
            });
          }
        } catch {
          networkErrorCount += 1;
          if (networkErrorCount >= 5) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            updateNodeData(id, {
              isRunning: false,
              error: 'Lost connection to server. Try generating again.',
              jobId: null,
            });
          }
        }
      }, 4000);
    },
    [id, updateNodeData],
  );

  // Get userId from store for credit billing
  const currentUserId = useStudioStore((s) => s.currentUserId);

  const handleRun = useCallback(async () => {
    const upstream = getUpstreamData(id);
    if (!upstream.prompt && !upstream.imageUrl) {
      updateNodeData(id, { error: 'Connect a Text Prompt or Image source node first' });
      return;
    }

    // Check model lock
    const model = MODEL_OPTIONS.find((m) => m.value === d.model);
    if (model?.locked) {
      updateNodeData(id, { error: 'This model requires the Pro plan ($60/mo). Upgrade to unlock.' });
      return;
    }

    // Check resolution lock
    const res = RESOLUTION_OPTIONS.find((r) => r.value === (d.resolution || '1K'));
    if (res?.locked) {
      updateNodeData(id, { error: '4K resolution requires Pro ($60) or Premium ($200) plan.' });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, outputUrl: null, progress: 0 });

    try {
      // Compress base64 images before sending to avoid body size limits
      const compressedImages = upstream.imageUrls.length > 0
        ? await compressImagesForApi(upstream.imageUrls)
        : [];

      const selectedModel = MODEL_OPTIONS.find((m) => m.value === d.model) || MODEL_OPTIONS[0];
      const fetchRes = await fetch('/api/studio/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId || undefined,
          prompt: upstream.prompt || '',
          imageUrl: compressedImages[0] || null,
          imageUrls: compressedImages.length > 0 ? compressedImages : null,
          model: d.model,
          provider: selectedModel.provider,
          duration: selectedModel.variableDuration ? d.duration : selectedModel.fixedDuration,
          aspectRatio: d.aspectRatio || '16:9',
          resolution: d.resolution || '1K',
        }),
      });

      if (!fetchRes.ok) {
        let errMsg = 'Video generation failed';
        try {
          const err = await fetchRes.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await fetchRes.text().catch(() => '');
          if (text.includes('Request Entity Too Large') || fetchRes.status === 413) {
            errMsg = 'Images too large. Try using smaller source images.';
          } else {
            errMsg = `Server error (${fetchRes.status})`;
          }
        }
        throw new Error(errMsg);
      }

      const result = await fetchRes.json();

      if (result.outputUrl) {
        updateNodeData(id, { outputUrl: result.outputUrl, isRunning: false, progress: 100 });
      } else if (result.jobId) {
        updateNodeData(id, { jobId: result.jobId, progress: 5 });
        pollStatus(result.jobId, selectedModel.provider, result.model || d.model);
      } else {
        throw new Error('No video job started. Try again.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      updateNodeData(id, { isRunning: false, error: message });
    }
  }, [id, d.model, d.duration, d.aspectRatio, d.resolution, currentUserId, getUpstreamData, updateNodeData, pollStatus]);

  // Batch trigger
  const batchVideoTrigger = useStudioStore((s) => s.batchVideoTrigger);
  const prevBatchRef = useRef(batchVideoTrigger);
  useEffect(() => {
    if (batchVideoTrigger > 0 && batchVideoTrigger !== prevBatchRef.current) {
      prevBatchRef.current = batchVideoTrigger;
      if (!d.isRunning) {
        handleRun();
      }
    }
  }, [batchVideoTrigger, d.isRunning, handleRun]);

  return (
    <div className="relative w-[400px]">
      <div className="bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-rose-600/20 to-pink-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-rose-500/20 flex items-center justify-center">
          <i className="fa-solid fa-film text-rose-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">VIDEO GENERATION</span>
      </div>

      {/* Body */}
      <div className="p-3 space-y-2.5">
        {/* Model */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 flex items-center justify-between">
            <span>Model</span>
            {estimatedCredits > 0 && (
              <span className="text-[9px] text-rose-300/60">~{estimatedCredits} credits</span>
            )}
          </label>
          <select
            value={d.model}
            onChange={(e) => updateNodeData(id, { model: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-rose-500/50 transition-all appearance-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#1a1a1a]">
                {m.locked ? '🔒 ' : ''}{m.label}{m.creditsPerSec > 0 ? ` (${m.creditsPerSec}cr/s)` : ' (Free)'}{m.locked ? ' [Pro $60/mo]' : ''}
              </option>
            ))}
          </select>
          {selectedModelDef?.locked && (
            <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <i className="fa-solid fa-lock text-[9px] text-amber-400"></i>
              <span className="text-[10px] text-amber-400">Requires Pro plan ($60/mo)</span>
            </div>
          )}
        </div>

        {/* Aspect Ratio */}
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
                  (d.aspectRatio || '16:9') === ar.value
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                    : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
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
                      : 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
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

        {/* Duration — only show slider for models that support variable duration */}
        <div>
          <label className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1 flex items-center justify-between">
            <span>Duration</span>
            <span className="text-white/60">{effectiveDuration}s</span>
          </label>
          {selectedModelDef?.variableDuration ? (
            <input
              type="range"
              min="5"
              max="10"
              step="1"
              value={d.duration}
              onChange={(e) => updateNodeData(id, { duration: parseInt(e.target.value) })}
              className="w-full accent-rose-500"
            />
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
              <i className="fa-solid fa-clock text-[9px] text-white/30"></i>
              <span className="text-[10px] text-white/40">
                Fixed at {selectedModelDef?.fixedDuration || 8}s for this model
              </span>
            </div>
          )}
        </div>

        {/* Local badge */}
        {(MODEL_OPTIONS.find((m) => m.value === d.model)?.provider === 'local') && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">LOCAL GPU — Free, no API cost</span>
          </div>
        )}

        {/* Run */}
        <button
          onClick={handleRun}
          disabled={d.isRunning || (selectedModelDef?.locked ?? false)}
          className={`w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            selectedModelDef?.locked
              ? 'bg-amber-600/20 text-amber-300 border border-amber-500/20'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          }`}
        >
          {d.isRunning ? (
            <>
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
              Generating ({d.progress}%)
            </>
          ) : selectedModelDef?.locked ? (
            <>
              <i className="fa-solid fa-lock text-xs"></i>
              Upgrade to Pro
            </>
          ) : (
            <>
              <i className="fa-solid fa-play text-xs"></i>
              Generate Video
            </>
          )}
        </button>

        {/* Progress bar */}
        {d.isRunning && (
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${d.progress}%` }}
            />
          </div>
        )}

        {d.error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{d.error}</div>
        )}

        {/* Video output */}
        {d.outputUrl && (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden border border-white/10">
              <video src={d.outputUrl} controls autoPlay loop muted className="w-full" />
            </div>
            <div className="flex gap-1.5">
              <a
                href={d.outputUrl}
                download={`draftly-video-${Date.now()}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 bg-rose-600/20 text-rose-300 hover:bg-rose-600/40 border border-rose-500/20"
              >
                <i className="fa-solid fa-download text-[10px]"></i>
                Download Video
              </a>
              <button
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center bg-white/5 text-white/50 hover:bg-white/10 border border-white/5"
                title="Open in new tab"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(d.outputUrl!, '_blank');
                }}
              >
                <i className="fa-solid fa-expand text-[10px]"></i>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(VideoGenNode);
