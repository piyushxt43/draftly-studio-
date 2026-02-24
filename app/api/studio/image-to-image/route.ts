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
    const {
      imageUrl,
      prompt = '',
      strength = 0.7,
      stylePrompt = '',
    } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const creditCost = CREDIT_COSTS.imageEdit;
    const auth = await enforceStudioLimits(body, { creditCost });
    if (!auth.allowed) return auth.errorResponse!;

    // Build a descriptive prompt for the variation
    const parts = [prompt, stylePrompt].filter(Boolean);
    const variationPrompt = parts.length > 0
      ? `Create a variation of this image with the following changes: ${parts.join(', ')}. Keep the main subject identical but apply the requested modifications. Strength of change: ${Math.round(strength * 100)}%.`
      : `Create a creative variation of this image. Keep the main subject but change the angle, lighting, or background slightly. Make it look like a different professional photo of the same subject.`;

    const result = await generateApiEasyImage({
      prompt: variationPrompt,
      model: 'nano-banana-pro',
      inputImageUrl: imageUrl,
    });

    if (result.images.length === 0) {
      return NextResponse.json({ error: 'No variations generated. Please try again.' }, { status: 500 });
    }

    if (auth.userId) await incrementStudioUsage(auth.userId, 'image', creditCost);

    return NextResponse.json({ images: result.images });
  } catch (error: unknown) {
    console.error('[studio/image-to-image] Error:', error);
    return NextResponse.json({ error: 'Image processing failed. Please try again.' }, { status: 500 });
  }
}
