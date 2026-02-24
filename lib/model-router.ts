/**
 * Model Router — Routes requests to the correct provider and enforces plan-tier access.
 *
 * Credit costs are set per-model to maintain ≥50% margin.
 * Frontend shows "~X images" using base model cost; higher-quality models
 * silently cost more credits (standard SaaS practice).
 *
 * Resolution tiers:
 *   Free:    max 768px
 *   Basic:   max 1024px
 *   Pro:     max 1024px
 *   Premium: max 1536px
 */

import { PLAN_LIMITS, CREDIT_COSTS, type PlanLimits } from './subscription-plans';

// ── Image model definitions ─────────────────────────────────────────

export interface ImageModelDef {
  id: string;
  label: string;
  provider: 'fal' | 'replicate' | 'api-easy' | 'local';
  falKey?: string;
  replicateKey?: string;
  apiEasyModel?: string;
  costPerImage: number;       // USD cost
  creditCost: number;         // credits charged to user
  maxResolution: number;
  tier: 'free' | 'pro' | 'premium';
}

export const IMAGE_MODELS: ImageModelDef[] = [
  // ── API-Easy — primary model (Nano Banana Pro) ───────────────────
  {
    id: 'nano-banana-pro',
    label: 'Nano Banana Pro (API-Easy)',
    provider: 'api-easy',
    apiEasyModel: 'nano-banana-pro',
    costPerImage: 0.045,
    creditCost: 5,                    // Primary model — available to free users (5 images on free plan)
    maxResolution: 4096,
    tier: 'free',
  },
  // ── fal.ai — batch & variety models ──────────────────────────────
  {
    id: 'flux-schnell',
    label: 'Flux Schnell (Fast)',
    provider: 'fal',
    falKey: 'flux-schnell',
    costPerImage: 0.01,
    creditCost: 3,                    // Low real cost, but keep credits = base
    maxResolution: 1024,
    tier: 'pro',                      // Locked behind Pro ($60) plan
  },
  {
    id: 'flux-dev',
    label: 'Flux Dev (Quality)',
    provider: 'fal',
    falKey: 'flux-dev',
    costPerImage: 0.02,
    creditCost: 3,
    maxResolution: 1024,
    tier: 'pro',
  },
  {
    id: 'flux-pro',
    label: 'Flux Pro (HD)',
    provider: 'fal',
    falKey: 'flux-pro',
    costPerImage: 0.04,
    creditCost: 4,                    // HD quality = slightly more credits
    maxResolution: 1536,
    tier: 'pro',
  },
  {
    id: 'fooocus',
    label: 'Fooocus (Creative)',
    provider: 'fal',
    falKey: 'fooocus',
    costPerImage: 0.02,
    creditCost: 3,
    maxResolution: 1024,
    tier: 'pro',
  },
  {
    id: 'stable-cascade',
    label: 'Stable Cascade',
    provider: 'fal',
    falKey: 'stable-cascade',
    costPerImage: 0.02,
    creditCost: 3,
    maxResolution: 1024,
    tier: 'pro',
  },
  // ── Premium-exclusive image models ───────────────────────────────
  {
    id: 'sdxl-turbo',
    label: 'SDXL Turbo',
    provider: 'fal',
    falKey: 'sdxl-turbo',
    costPerImage: 0.01,
    creditCost: 2,                    // Fast & cheap → lower credits
    maxResolution: 1024,
    tier: 'premium',
  },
  {
    id: 'playground-v2.5',
    label: 'Playground v2.5',
    provider: 'fal',
    falKey: 'playground-v2.5',
    costPerImage: 0.01,
    creditCost: 2,
    maxResolution: 1024,
    tier: 'premium',
  },
  {
    id: 'juggernaut-xl',
    label: 'Juggernaut XL',
    provider: 'fal',
    falKey: 'juggernaut-xl',
    costPerImage: 0.02,
    creditCost: 4,                    // Photorealistic specialty
    maxResolution: 1536,
    tier: 'premium',
  },
  {
    id: 'realvisxl-v4',
    label: 'RealVisXL v4',
    provider: 'fal',
    falKey: 'realvisxl-v4',
    costPerImage: 0.02,
    creditCost: 4,
    maxResolution: 1536,
    tier: 'premium',
  },
  {
    id: 'dreamshaper-xl',
    label: 'DreamShaper XL',
    provider: 'fal',
    falKey: 'dreamshaper-xl',
    costPerImage: 0.01,
    creditCost: 2,
    maxResolution: 1024,
    tier: 'premium',
  },
];

// ── Video model definitions ─────────────────────────────────────────

export interface VideoModelDef {
  id: string;
  label: string;
  provider: 'fal' | 'replicate' | 'api-easy' | 'local';
  falKey?: string;
  replicateKey?: string;
  apiEasyModel?: string;
  costPerSec: number;         // USD cost per second
  creditCostPerSec: number;   // credits per second
  maxDuration: number;        // max seconds
  tier: 'free' | 'pro' | 'premium';
}

export const VIDEO_MODELS: VideoModelDef[] = [
  // ── API-Easy Veo — primary video models ──────────────────────────
  {
    id: 'veo-3.0',
    label: 'Veo 3.0 (API-Easy)',
    provider: 'api-easy',
    apiEasyModel: 'veo-3.1',
    costPerSec: 0.60,
    creditCostPerSec: 12,             // 8s clip = 96 credits
    maxDuration: 8,
    tier: 'pro',
  },
  {
    id: 'veo-3.0-fast',
    label: 'Veo 3.0 Fast (API-Easy)',
    provider: 'api-easy',
    apiEasyModel: 'veo-3.1-fast',
    costPerSec: 0.40,
    creditCostPerSec: 8,
    maxDuration: 8,
    tier: 'free',
  },
  // ── fal.ai video models ──────────────────────────────────────────
  {
    id: 'wan-video',
    label: 'WAN Video (Fast)',
    provider: 'fal',
    falKey: 'wan-video',
    costPerSec: 0.15,
    creditCostPerSec: 8,              // 5s clip = 40 credits
    maxDuration: 5,
    tier: 'pro',
  },
  {
    id: 'kling-1.6',
    label: 'Kling 1.6',
    provider: 'fal',
    falKey: 'kling-1.6',
    costPerSec: 0.25,
    creditCostPerSec: 9,              // 8s clip = 72 credits
    maxDuration: 10,
    tier: 'pro',
  },
  {
    id: 'kling-1.6-pro',
    label: 'Kling 1.6 Pro',
    provider: 'fal',
    falKey: 'kling-1.6-pro',
    costPerSec: 0.35,
    creditCostPerSec: 9,              // 8s clip = 72 credits
    maxDuration: 10,
    tier: 'pro',
  },
  {
    id: 'minimax-video-fal',
    label: 'Minimax Video',
    provider: 'fal',
    falKey: 'minimax-video-fal',
    costPerSec: 0.30,
    creditCostPerSec: 8,              // 6s clip = 48 credits
    maxDuration: 6,
    tier: 'pro',
  },
  {
    id: 'luma-dream-machine',
    label: 'Luma Dream Machine',
    provider: 'fal',
    falKey: 'luma-dream-machine',
    costPerSec: 0.25,
    creditCostPerSec: 8,              // 5s clip = 40 credits
    maxDuration: 5,
    tier: 'pro',
  },
  {
    id: 'hunyuan-video',
    label: 'Hunyuan Video',
    provider: 'fal',
    falKey: 'hunyuan-video',
    costPerSec: 0.20,
    creditCostPerSec: 8,              // 6s clip = 48 credits
    maxDuration: 6,
    tier: 'pro',
  },
];

// ── Router functions ────────────────────────────────────────────────

/**
 * Get list of image models available for a plan
 */
export function getAvailableImageModels(plan: string): ImageModelDef[] {
  const tierOrder = ['free', 'basic', 'pro', 'premium'];
  const planIndex = tierOrder.indexOf(plan);
  if (planIndex === -1) return IMAGE_MODELS.filter(m => m.tier === 'free');

  // Basic plan: API-Easy models only
  if (plan === 'basic') {
    return IMAGE_MODELS.filter(m => m.provider === 'api-easy' && (m.tier === 'free' || m.tier === 'pro'));
  }

  return IMAGE_MODELS.filter(m => tierOrder.indexOf(m.tier) <= planIndex);
}

/**
 * Get list of video models available for a plan
 */
export function getAvailableVideoModels(plan: string): VideoModelDef[] {
  const tierOrder = ['free', 'basic', 'pro', 'premium'];
  const planIndex = tierOrder.indexOf(plan);
  if (planIndex === -1) return [];

  // Basic plan: API-Easy video models only (Veo 3.0 Fast)
  if (plan === 'basic') {
    return VIDEO_MODELS.filter(m => m.provider === 'api-easy');
  }

  return VIDEO_MODELS.filter(m => tierOrder.indexOf(m.tier) <= planIndex);
}

/**
 * Resolve an image model by ID, respecting plan access.
 * Falls back to cheapest available model if requested model is above plan tier.
 */
export function resolveImageModel(modelId: string, plan: string): ImageModelDef {
  const available = getAvailableImageModels(plan);
  const requested = available.find(m => m.id === modelId);
  if (requested) return requested;

  // Fallback to cheapest available
  return available[0] || IMAGE_MODELS[0];
}

/**
 * Resolve a video model by ID, respecting plan access.
 */
export function resolveVideoModel(modelId: string, plan: string): VideoModelDef {
  const available = getAvailableVideoModels(plan);
  const requested = available.find(m => m.id === modelId);
  if (requested) return requested;

  // Fallback to cheapest available
  return available[0] || VIDEO_MODELS[0];
}

/**
 * Calculate credit cost for an image generation.
 * Always uses the model's own creditCost (margin-safe per-model pricing).
 */
export function getImageCreditCost(modelId: string, _resolution?: number): number {
  const model = IMAGE_MODELS.find(m => m.id === modelId);
  if (!model) return CREDIT_COSTS.image; // fallback: 3 credits
  return model.creditCost;
}

/**
 * Calculate credit cost for a video generation
 */
export function getVideoCreditCost(modelId: string, durationSec: number): number {
  const model = VIDEO_MODELS.find(m => m.id === modelId);
  const perSec = model?.creditCostPerSec || CREDIT_COSTS.videoPerSec;
  return Math.ceil(durationSec * perSec);
}

/**
 * Clamp resolution to plan limit
 */
export function clampResolution(width: number, height: number, plan: string): { width: number; height: number } {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const maxDim = limits.maxResolution;

  if (width <= maxDim && height <= maxDim) return { width, height };

  const scale = maxDim / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
