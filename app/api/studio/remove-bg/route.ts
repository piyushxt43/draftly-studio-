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
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const creditCost = CREDIT_COSTS.removeBG;
    const auth = await enforceStudioLimits(body, { creditCost });
    if (!auth.allowed) return auth.errorResponse!;

    // Use API-Easy Nano Banana to remove the background
    const result = await generateApiEasyImage({
      prompt: 'Remove the background from this image completely. Keep only the main subject/product with a fully transparent or pure white background. Maintain all details of the subject perfectly.',
      model: 'nano-banana-pro',
      inputImageUrl: imageUrl,
    });

    if (result.images.length === 0) {
      return NextResponse.json({ error: 'Background removal failed. No output image.' }, { status: 500 });
    }

    if (auth.userId) await incrementStudioUsage(auth.userId, 'image', creditCost);

    return NextResponse.json({ image: result.images[0] });
  } catch (error: unknown) {
    console.error('[studio/remove-bg] Error:', error);
    return NextResponse.json({ error: 'Background removal failed. Please try again.' }, { status: 500 });
  }
}
