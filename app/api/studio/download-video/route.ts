import { NextRequest, NextResponse } from 'next/server';
import { downloadApiEasyVideo } from '@/lib/api-easy-studio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/studio/download-video?uri=<api-easy-video-uri>
 *
 * Proxy-downloads an API-Easy-generated video and streams it back as `video/mp4`.
 * The client can set this URL as the `<video src>` directly.
 */
export async function GET(req: NextRequest) {
  try {
    const uri = req.nextUrl.searchParams.get('uri');
    if (!uri) {
      return NextResponse.json({ error: 'uri is required' }, { status: 400 });
    }

    const videoBuffer = await downloadApiEasyVideo(uri);

    // Stream the video binary back to the client
    return new Response(Buffer.from(videoBuffer) as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
        'Content-Disposition': 'inline; filename="draftly-video.mp4"',
      },
    });
  } catch (error: unknown) {
    console.error('[download-video] Error:', error);
    return NextResponse.json(
      { error: 'Failed to download video' },
      { status: 500 },
    );
  }
}
