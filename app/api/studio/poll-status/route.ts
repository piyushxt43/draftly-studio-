import { NextRequest, NextResponse } from 'next/server';
import { getFalStatus } from '@/lib/fal';
import { getReplicatePrediction } from '@/lib/replicate';
import { pollApiEasyOperation } from '@/lib/api-easy-studio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const provider = searchParams.get('provider');
    const model = searchParams.get('model');

    if (!jobId || !provider) {
      return NextResponse.json({ error: 'jobId and provider are required' }, { status: 400 });
    }

    if (provider === 'api-easy') {
      // ── API-Easy video polling ───────────────────────────────
      const result = await pollApiEasyOperation(jobId);

      if (result.done && result.videoUri) {
        // API-Easy video URIs are already accessible URLs; returning direct URL
        // avoids buffering large binaries through our serverless function.
        const directOrProxyUrl =
          result.videoUri.startsWith('http') || result.videoUri.startsWith('data:')
            ? result.videoUri
            : `/api/studio/download-video?uri=${encodeURIComponent(result.videoUri)}`;
        return NextResponse.json({
          status: 'completed',
          outputUrl: directOrProxyUrl,
        });
      } else if (result.done && result.error) {
        return NextResponse.json({
          status: 'failed',
          error: result.error,
        });
      }

      // Still processing — no granular progress from API, client increments
      return NextResponse.json({ status: 'processing', progress: null });
    } else if (provider === 'fal') {
      // ── fal.ai polling ─────────────────────────────────────
      // Use the model key passed from the generate-video route
      const falModelKey = model || 'kling-1.6';

      const result = await getFalStatus(falModelKey as any, jobId);

      if (result.status === 'completed' && result.data) {
        // Different models return video in different shapes
        const data = result.data as Record<string, unknown>;
        let videoUrl: string | null = null;

        if (data.video && typeof data.video === 'object') {
          videoUrl = (data.video as { url: string }).url;
        } else if (typeof data.video === 'string') {
          videoUrl = data.video;
        } else if (data.video_url && typeof data.video_url === 'string') {
          videoUrl = data.video_url;
        } else if (data.output && typeof data.output === 'string') {
          videoUrl = data.output;
        }

        return NextResponse.json({
          status: 'completed',
          outputUrl: videoUrl,
        });
      } else if (result.status === 'failed') {
        return NextResponse.json({
          status: 'failed',
          error: 'Video generation failed on fal.ai',
        });
      }

      // fal.ai still processing — let client handle incremental progress
      return NextResponse.json({ status: 'processing', progress: null });
    } else {
      // ── Replicate polling ──────────────────────────────────
      const prediction = await getReplicatePrediction(jobId);

      if (prediction.status === 'succeeded') {
        let outputUrl: string | null = null;

        if (typeof prediction.output === 'string') {
          outputUrl = prediction.output;
        } else if (Array.isArray(prediction.output) && prediction.output.length > 0) {
          outputUrl = typeof prediction.output[0] === 'string'
            ? prediction.output[0]
            : (prediction.output[0] as { url?: string })?.url || null;
        } else if (prediction.output && typeof prediction.output === 'object') {
          const out = prediction.output as { url?: string; video?: string };
          outputUrl = out.url || out.video || null;
        }

        return NextResponse.json({
          status: 'completed',
          outputUrl,
        });
      } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
        return NextResponse.json({
          status: 'failed',
          error: prediction.error || 'Video generation failed',
        });
      }

      // Map Replicate status to progress estimate
      const progressMap: Record<string, number> = {
        starting: 10,
        processing: 50,
      };

      return NextResponse.json({
        status: 'processing',
        progress: progressMap[prediction.status] || 30,
      });
    }
  } catch (error: unknown) {
    console.error('[studio/poll-status] Error:', error);
    return NextResponse.json({ error: 'Status check failed.' }, { status: 500 });
  }
}
