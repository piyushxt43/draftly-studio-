import { fal } from '@fal-ai/client';

let initialized = false;

export function initFalClient() {
  if (initialized) return;

  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error('FAL_KEY is not set. Add it to your .env.local file.');
  }

  fal.config({ credentials: key });
  initialized = true;
}

// ── Model endpoints ──────────────────────────────────────────────────

export const FAL_MODELS = {
  // Image generation
  'flux-schnell': 'fal-ai/flux/schnell',
  'flux-pro': 'fal-ai/flux-pro/v1.1',
  'flux-dev': 'fal-ai/flux/dev',
  'fooocus': 'fal-ai/fooocus',
  'stable-cascade': 'fal-ai/stable-cascade',

  // Image-to-image
  'flux-redux': 'fal-ai/flux/dev/redux',

  // Video generation
  'kling-1.6': 'fal-ai/kling-video/v1.6/standard/image-to-video',
  'kling-1.6-pro': 'fal-ai/kling-video/v1.6/pro/image-to-video',
  'luma-dream-machine': 'fal-ai/luma-dream-machine',
  'hunyuan-video': 'fal-ai/hunyuan-video',
  'veo-2': 'fal-ai/veo2',
  'minimax-video-fal': 'fal-ai/minimax-video',
  'wan-video': 'fal-ai/wan/v2.1/image-to-video',
} as const;

// ── Types ────────────────────────────────────────────────────────────

export interface FalImageResult {
  images: Array<{ url: string; width: number; height: number }>;
  seed?: number;
}

export interface FalVideoResult {
  video: { url: string };
  request_id?: string;
}

// ── Run fal.ai model (synchronous - waits for result) ────────────────

export async function runFalModel(
  modelKey: keyof typeof FAL_MODELS,
  input: Record<string, unknown>,
): Promise<unknown> {
  initFalClient();
  const endpointId = FAL_MODELS[modelKey];

  const result = await fal.subscribe(endpointId, {
    input: input as any,
    logs: false,
  });

  return result.data;
}

// ── Submit fal.ai model (async - returns request ID for polling) ─────

export async function submitFalModel(
  modelKey: keyof typeof FAL_MODELS,
  input: Record<string, unknown>,
): Promise<{ requestId: string }> {
  initFalClient();
  const endpointId = FAL_MODELS[modelKey];

  const { request_id } = await fal.queue.submit(endpointId, { input: input as any });

  return { requestId: request_id };
}

// ── Check fal.ai job status ──────────────────────────────────────────

export async function getFalStatus(
  modelKey: keyof typeof FAL_MODELS,
  requestId: string,
): Promise<{ status: string; data?: unknown }> {
  initFalClient();
  const endpointId = FAL_MODELS[modelKey];

  const status = await fal.queue.status(endpointId, {
    requestId,
    logs: false,
  });

  if (status.status === 'COMPLETED') {
    const result = await fal.queue.result(endpointId, { requestId });
    return { status: 'completed', data: result.data };
  }

  // IN_QUEUE or IN_PROGRESS
  const failedStatuses = ['FAILED'];
  if (failedStatuses.includes(status.status as string)) {
    return { status: 'failed' };
  }

  return { status: 'processing' };
}
