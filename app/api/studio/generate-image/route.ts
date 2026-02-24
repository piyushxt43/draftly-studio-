import { NextRequest, NextResponse } from 'next/server';
import { runFalModel, type FalImageResult } from '@/lib/fal';
import { runReplicatePrediction } from '@/lib/replicate';
import { generateApiEasyImage } from '@/lib/api-easy-studio';
import { enforceStudioLimits, incrementStudioUsage } from '@/lib/studio-auth';
import { resolveImageModel, clampResolution, getImageCreditCost } from '@/lib/model-router';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Build a style suffix for the prompt
function buildStyledPrompt(prompt: string, style: string): string {
  const styleMap: Record<string, string> = {
    photorealistic: 'ultra-realistic photograph, 8K resolution, detailed lighting',
    cinematic: 'cinematic shot, dramatic lighting, film grain, anamorphic lens',
    anime: 'anime style, Studio Ghibli inspired, vibrant colors',
    '3d-render': '3D render, octane render, physically based rendering, volumetric lighting',
    illustration: 'digital illustration, hand-drawn style, detailed linework',
    'oil-painting': 'oil painting, textured canvas, classical fine art style',
    watercolor: 'watercolor painting, soft edges, paint splashes, paper texture',
    'pixel-art': 'pixel art, 16-bit retro style, crisp edges',
    'concept-art': 'concept art, matte painting, environment design, epic scale',
  };

  const suffix = styleMap[style];
  return suffix ? `${prompt}, ${suffix}` : prompt;
}

// Map aspect ratio string to width/height
function aspectRatioToDimensions(ar: string): { width: number; height: number } {
  const map: Record<string, { width: number; height: number }> = {
    '1:1': { width: 768, height: 768 },
    '16:9': { width: 960, height: 540 },
    '9:16': { width: 540, height: 960 },
    '4:3': { width: 896, height: 672 },
    '3:4': { width: 672, height: 896 },
  };
  return map[ar] || map['1:1'];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      style = 'photorealistic',
      model = 'flux-schnell',
      provider: requestedProvider,
      aspectRatio = '1:1',
      numOutputs = 1,
      guidanceScale = 7.5,
      inputImage = null,
      inputImages = null,
    } = body;

    // Combine inputImages array and legacy inputImage into a single array
    const allInputImages: string[] = [];
    if (inputImages && Array.isArray(inputImages)) {
      allInputImages.push(...inputImages.filter(Boolean));
    } else if (inputImage) {
      allInputImages.push(inputImage);
    }

    if ((!prompt || typeof prompt !== 'string') && allInputImages.length === 0) {
      return NextResponse.json({ error: 'A prompt or input image is required' }, { status: 400 });
    }

    const styledPrompt = buildStyledPrompt(prompt || '', style);

    // ── Local provider (no auth/billing needed — free local GPU) ───
    if (requestedProvider === 'local') {
      const { width, height } = aspectRatioToDimensions(aspectRatio);
      const localUrl = process.env.LOCAL_AI_URL || 'http://localhost:8000';
      try {
        const localRes = await fetch(`${localUrl}/api/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: styledPrompt,
            width,
            height,
            num_images: numOutputs,
            guidance_scale: guidanceScale,
            num_inference_steps: 30,
          }),
        });

        if (!localRes.ok) {
          const err = await localRes.json().catch(() => ({ detail: 'Local server error' }));
          throw new Error(err.detail || 'Local image generation failed');
        }

        const result = await localRes.json();
        return NextResponse.json({ images: result.images });
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
    const auth = await enforceStudioLimits(body);
    if (!auth.allowed) return auth.errorResponse!;

    const plan = auth.plan || 'free';
    const resolvedModel = resolveImageModel(model, plan);

    // Clamp resolution to plan limit
    const rawDims = aspectRatioToDimensions(aspectRatio);
    const { width, height } = clampResolution(rawDims.width, rawDims.height, plan);

    // Calculate credit cost
    const maxDim = Math.max(width, height);
    const creditCost = getImageCreditCost(resolvedModel.id, maxDim);

    // Re-check with actual credit cost
    const creditCheck = await enforceStudioLimits(body, { creditCost });
    if (!creditCheck.allowed) return creditCheck.errorResponse!;

    const images: string[] = [];

    // ── API-Easy provider (Nano Banana Pro — primary) ─────────────
    if (resolvedModel.provider === 'api-easy') {
      const result = await generateApiEasyImage({
        prompt: styledPrompt,
        model: resolvedModel.apiEasyModel,
        aspectRatio,
        inputImageUrl: allInputImages[0] || undefined,
        inputImageUrls: allInputImages.length > 0 ? allInputImages : undefined,
      });

      if (result.images.length === 0) {
        return NextResponse.json({ error: 'API-Easy returned no images. Try a different prompt.' }, { status: 500 });
      }

      if (auth.userId) await incrementStudioUsage(auth.userId, 'image', creditCost);
      return NextResponse.json({
        images: result.images,
        model: resolvedModel.id,
        creditsUsed: creditCost,
      });
    }

    // ── fal.ai provider (default) ──────────────────────────────────
    if (resolvedModel.provider === 'fal') {
      const falModelKey = resolvedModel.falKey || 'flux-schnell';

      const result = (await runFalModel(falModelKey as any, {
        prompt: styledPrompt,
        image_size: { width, height },
        num_images: numOutputs,
        ...(falModelKey !== 'flux-schnell' ? { guidance_scale: guidanceScale } : {}),
        ...(allInputImages.length > 0 ? { image_url: allInputImages[0] } : {}),
      })) as FalImageResult;

      if (result.images) {
        for (const img of result.images) {
          images.push(img.url);
        }
      }
    } else if (resolvedModel.provider === 'replicate') {
      // ── Replicate fallback ─────────────────────────────────────
      const output = await runReplicatePrediction(
        (resolvedModel.replicateKey || 'flux-schnell') as any,
        {
          prompt: styledPrompt,
          width,
          height,
          num_outputs: numOutputs,
          ...(model !== 'flux-schnell' ? { guidance_scale: guidanceScale } : {}),
        },
      );

      if (Array.isArray(output)) {
        for (const item of output) {
          if (typeof item === 'string') images.push(item);
          else if (item?.url) images.push(item.url);
        }
      } else if (typeof output === 'string') {
        images.push(output);
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images generated. Please try again.' }, { status: 500 });
    }

    // Increment usage counter (credit-based)
    if (auth.userId) await incrementStudioUsage(auth.userId, 'image', creditCost);

    return NextResponse.json({
      images,
      model: resolvedModel.id,
      creditsUsed: creditCost,
    });
  } catch (error: unknown) {
    console.error('[studio/generate-image] Error:', error);
    return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 500 });
  }
}
