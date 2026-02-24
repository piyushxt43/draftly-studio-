import { NextRequest, NextResponse } from 'next/server';
import { generateApiEasyImage } from '@/lib/api-easy-studio';
import { enforceStudioLimits, incrementStudioUsage } from '@/lib/studio-auth';
import { CREDIT_COSTS } from '@/lib/subscription-plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, scale = 2 } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const creditCost = CREDIT_COSTS.upscale;
    const auth = await enforceStudioLimits(body, { creditCost });
    if (!auth.allowed) return auth.errorResponse!;

    // Use API-Easy Nano Banana to upscale via prompt engineering
    const scaleLabel = scale >= 4 ? '4x' : '2x';
    const result = await generateApiEasyImage({
      prompt: `Upscale this image by ${scaleLabel}. Enhance the resolution and details while maintaining the exact same content, composition, colors, and style. Make it sharper and higher quality. Do not change or alter any content in the image.`,
      model: 'nano-banana-pro',
      inputImageUrl: imageUrl,
      imageSize: scale >= 4 ? '4K' : '2K',
    });

    if (result.images.length === 0) {
      return NextResponse.json({ error: 'Upscale failed. No output image.' }, { status: 500 });
    }

    if (auth.userId) await incrementStudioUsage(auth.userId, 'image', creditCost);

    return NextResponse.json({ image: result.images[0] });
  } catch (error: unknown) {
    console.error('[studio/upscale] Error:', error);
    return NextResponse.json({ error: 'Upscale failed. Please try again.' }, { status: 500 });
  }
}
