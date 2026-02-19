import { NextResponse } from 'next/server';

const LOCAL_SERVER = 'http://localhost:8000';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${LOCAL_SERVER}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json({ running: false });
    }

    const data = await res.json();
    return NextResponse.json({
      running: true,
      device: data.device,
      gpu: data.gpu,
      vram: data.vram,
      image_model_loaded: data.image_model_loaded,
      video_model_loaded: data.video_model_loaded,
    });
  } catch {
    return NextResponse.json({ running: false });
  }
}
