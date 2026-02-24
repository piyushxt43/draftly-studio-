import Replicate from 'replicate';

let replicateClient: Replicate | null = null;

export function getReplicateClient(): Replicate {
  if (replicateClient) return replicateClient;

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is not set. Add it to your .env.local file.');
  }

  replicateClient = new Replicate({ auth: token });
  return replicateClient;
}

// ── Model identifiers ────────────────────────────────────────────────

export const REPLICATE_MODELS = {
  // Image generation
  'sdxl': 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-pro': 'black-forest-labs/flux-1.1-pro',
  'flux-dev': 'black-forest-labs/flux-dev',
  'ideogram': 'ideogram-ai/ideogram-v2',
  'playground-v3': 'playgroundai/playground-v2.5-1024px-aesthetic:a45f82a1382bed5c7aeb861dac7c7d191b0fdf74d8d57c4a0e6ed7d4d0bf7d24',

  // Image-to-image
  'ip-adapter-sdxl': 'lucataco/ip_adapter_face_sdxl:3fdb8017e9e485e0e1525b3dc2d79466de0babe4dc1a0a0f35fdd73679d0b4e6',

  // Video generation
  'minimax-video': 'minimax/video-01',
  'wan-video': 'wan-video/wan-2.1-i2v-480p',

  // Utility
  'real-esrgan': 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
  'rembg': 'cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003',
} as const;

// ── Helper to run a Replicate prediction ─────────────────────────────

export async function runReplicatePrediction(
  modelKey: keyof typeof REPLICATE_MODELS,
  input: Record<string, unknown>,
): Promise<unknown> {
  const client = getReplicateClient();
  const modelId = REPLICATE_MODELS[modelKey];

  const output = await client.run(modelId as `${string}/${string}`, { input });
  return output;
}

// ── Async prediction (for long-running tasks like video) ─────────────

export async function createReplicatePrediction(
  modelKey: keyof typeof REPLICATE_MODELS,
  input: Record<string, unknown>,
): Promise<{ id: string; status: string }> {
  const client = getReplicateClient();
  const modelId = REPLICATE_MODELS[modelKey];

  // Parse the model string
  const [owner, rest] = (modelId as string).split('/');
  const parts = rest.split(':');
  const modelName = parts[0];
  const version = parts[1];

  let prediction;
  if (version) {
    prediction = await client.predictions.create({
      version,
      input,
    });
  } else {
    prediction = await client.predictions.create({
      model: `${owner}/${modelName}`,
      input,
    });
  }

  return { id: prediction.id, status: prediction.status };
}

export async function getReplicatePrediction(predictionId: string) {
  const client = getReplicateClient();
  const prediction = await client.predictions.get(predictionId);
  return prediction;
}
