import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Proxy health check to the local AI server.
 * Returns the server status or an error if it's not running.
 */
export async function GET() {
  const localUrl = process.env.LOCAL_AI_URL || 'http://localhost:8000';

  try {
    const res = await fetch(`${localUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json({ running: false, error: 'Server returned error' });
    }

    const data = await res.json();
    return NextResponse.json({ running: true, ...data });
  } catch {
    return NextResponse.json({ running: false, error: 'Local AI server is not running' });
  }
}
