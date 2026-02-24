import { NextRequest, NextResponse } from 'next/server';
import { submitFalModel } from '@/lib/fal';
import { createReplicatePrediction } from '@/lib/replicate';
import { startApiEasyVideoGeneration } from '@/lib/api-easy-studio';
import { enforceStudioLimits, incrementStudioUsage } from '@/lib/studio-auth';
import { resolveVideoModel, getVideoCreditCost } from '@/lib/model-router';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt = '',
      imageUrl = null,
      imageUrls = null,
      model = 'wan-video',
      duration = 5,
      aspectRatio = '16:9',
      resolution = '1K',
    } = body;

    // Combine imageUrls array and legacy imageUrl into a single array
    const allImageUrls: string[] = [];
    if (imageUrls && Array.isArray(imageUrls)) {
      allImageUrls.push(...imageUrls.filter(Boolean));
    } else if (imageUrl) {
      allImageUrls.push(imageUrl);
    }
    // Primary image for providers that only support one
    const primaryImageUrl = allImageUrls[0] || null;

    if (!prompt && allImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Either a prompt or an image URL is required' },
        { status: 400 },
      );
    }

    // ── Local provider (no auth/billing — free local GPU) ───────────
    if (body.provider === 'local') {
      const localUrl = process.env.LOCAL_AI_URL || 'http://localhost:8000';
      try {
        let localImagePath: string | null = null;
        if (primaryImageUrl) {
          const imgRes = await fetch(primaryImageUrl);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const formData = new FormData();
            formData.append('file', blob, 'input.png');
            const uploadRes = await fetch(`${localUrl}/api/upload-image`, {
              method: 'POST',
              body: formData,
            });
            if (uploadRes.ok) {
              const uploadResult = await uploadRes.json();
              localImagePath = uploadResult.path;
            }
          }
        }

        const numFrames = 16;
        const frameRate = 8.0;

        const localRes = await fetch(`${localUrl}/api/generate-video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt || '',
            width: 512,
            height: 512,
            num_frames: numFrames,
            frame_rate: frameRate,
            image_path: localImagePath,
          }),
        });

        if (!localRes.ok) {
          const err = await localRes.json().catch(() => ({ detail: 'Local server error' }));
          throw new Error(err.detail || 'Local video generation failed');
        }

        const result = await localRes.json();
        return NextResponse.json({
          outputUrl: result.video_url,
          provider: 'local',
          model: 'local-animatediff',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to connect to local AI server';
        if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED')) {
          return NextResponse.json(
            { error: 'Local AI server is not running. Start it with: cd local-server && python server.py' },
            { status: 503 },
          );
        }
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // ── Resolve model via router (enforces plan tier) ──────────────
    const durationSec = Math.min(duration, 10);  // Hard cap
    const creditCost = getVideoCreditCost(model, durationSec);

    const auth = await enforceStudioLimits(body, { isVideo: true, creditCost });
    if (!auth.allowed) return auth.errorResponse!;

    const plan = auth.plan || 'free';
    const resolvedModel = resolveVideoModel(model, plan);

    // Re-calculate credit cost with resolved model (may differ from requested)
    const finalCreditCost = getVideoCreditCost(resolvedModel.id, durationSec);

    // ── API-Easy / Veo provider (premium only) ─────────────────────
    if (resolvedModel.provider === 'api-easy') {
      const apiEasyModel = resolvedModel.apiEasyModel || 'veo-3.1-fast';
      const veoDuration = 8; // Veo-style models generate fixed 8s clips in this flow

      const veoAspectRatio = (aspectRatio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16';

      const result = await startApiEasyVideoGeneration({
        prompt: prompt || '',
        model: apiEasyModel,
        aspectRatio: veoAspectRatio,
        durationSeconds: veoDuration,
        imageUrl: primaryImageUrl,
      });

      if (auth.userId) await incrementStudioUsage(auth.userId, 'video', finalCreditCost);

      return NextResponse.json({
        jobId: result.operationName,
        provider: 'api-easy',
        model: resolvedModel.id,
        creditsUsed: finalCreditCost,
      });
    }

    // ── fal.ai provider (default for pro) ──────────────────────────
    if (resolvedModel.provider === 'fal') {
      const input: Record<string, unknown> = {};

      if (primaryImageUrl) input.image_url = primaryImageUrl;
      if (prompt) input.prompt = prompt;

      // Model-specific duration handling
      if (resolvedModel.id === 'kling-1.6' || resolvedModel.id === 'kling-1.6-pro') {
        input.duration = String(durationSec);
      }

      const falModelKey = resolvedModel.falKey || 'wan-video';
      const { requestId } = await submitFalModel(falModelKey as any, input);

      if (auth.userId) await incrementStudioUsage(auth.userId, 'video', finalCreditCost);

      return NextResponse.json({
        jobId: requestId,
        provider: 'fal',
        model: resolvedModel.id,
        creditsUsed: finalCreditCost,
      });
    }

    // ── Replicate fallback ─────────────────────────────────────────
    const input: Record<string, unknown> = {};
    if (model === 'minimax-video') {
      if (primaryImageUrl) input.first_frame_image = primaryImageUrl;
      if (prompt) input.prompt = prompt;
    } else {
      if (primaryImageUrl) input.image = primaryImageUrl;
      if (prompt) input.prompt = prompt;
    }

    const { id: predictionId } = await createReplicatePrediction('minimax-video', input);

    if (auth.userId) await incrementStudioUsage(auth.userId, 'video', finalCreditCost);

    return NextResponse.json({
      jobId: predictionId,
      provider: 'replicate',
      model: resolvedModel.id,
      creditsUsed: finalCreditCost,
    });
  } catch (error: unknown) {
    console.error('[studio/generate-video] Error:', error);
    return NextResponse.json({ error: 'Video generation failed. Please try again.' }, { status: 500 });
  }
}
