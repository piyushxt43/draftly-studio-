import { NextRequest, NextResponse } from 'next/server';

const LOCAL_SERVER = 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, aspectRatio = '16:9' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const dimMap: Record<string, { w: number; h: number }> = {
      '16:9': { w: 512, h: 288 },
      '9:16': { w: 288, h: 512 },
      '1:1': { w: 512, h: 512 },
      '4:3': { w: 512, h: 384 },
    };
    const dims = dimMap[aspectRatio] || dimMap['16:9'];

    const res = await fetch(`${LOCAL_SERVER}/api/generate-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        width: dims.w,
        height: dims.h,
        num_frames: 16,
        frame_rate: 8.0,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Local server error' }));
      return NextResponse.json(
        { error: err.detail || 'Local server error' },
        { status: res.status },
      );
    }

    const result = await res.json();
    return NextResponse.json({ outputUrl: result.video_url || result.gif_url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return NextResponse.json(
        { error: 'Local AI server not running. Start it with: cd local-server && python server.py' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
