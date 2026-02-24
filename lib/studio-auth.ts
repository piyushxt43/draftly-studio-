import { NextResponse } from 'next/server';

interface StudioAuthResult {
  allowed: boolean;
  userId?: string;
  plan?: string;
  errorResponse?: NextResponse;
}

/**
 * OSS studio ships without hosted auth/billing.
 * Keep the same interface as Draftly so API routes remain compatible.
 */
export async function enforceStudioLimits(
  body: Record<string, unknown>,
  _options: { isVideo?: boolean; creditCost?: number } = {},
): Promise<StudioAuthResult> {
  const userId = body.userId as string | undefined;
  return { allowed: true, userId, plan: 'oss' };
}

/**
 * No-op in OSS mode.
 */
export async function incrementStudioUsage(
  _userId: string,
  _type: 'image' | 'video' = 'image',
  _creditCost: number = 1,
): Promise<void> {
  return;
}
