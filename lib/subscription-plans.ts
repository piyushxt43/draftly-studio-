/**
 * Subscription Plans — Credit-Based System (50% margin target)
 *
 * Backend credit costs per model (users don't see these directly):
 *   Nano Banana Pro     = 5 credits/image   (real cost ~$0.045) — primary model
 *   Flux Schnell        = 3 credits/image   (real cost ~$0.01)  — locked behind Pro
 *   Other image models  = 2–4 credits/image
 *   Veo 3.0 Fast (8s)   = 60 credits/clip   (real cost ~$0.50)
 *   Pro video models    = 40–96 credits/clip
 *
 * Plan economics (50% margin):
 *   Basic  ($25/mo, 1,500 cr): worst case 300 Pro imgs × $0.045 = $13.50 → 46% margin
 *   Pro    ($60/mo, 3,600 cr): worst case 720 Pro imgs × $0.045 = $32.40 → 46% margin
 *   Premium($200/mo, 12,000 cr): worst case 2400 imgs × $0.045 = $108 → 46% margin
 *   Realistic mix (base imgs + some video) keeps margin ≥50%
 */

export interface PlanLimits {
  plan: 'free' | 'tester' | 'basic' | 'pro' | 'premium';
  credits: number;                   // Monthly credits
  fullAppGenerations: number;
  uiPreviews: number;
  chats: number;
  canIterate: boolean;
  studioVideoAllowed: boolean;
  studioBatchAllowed: boolean;
  studioAllModels: boolean;          // Can use premium models (Gemini, Veo, etc.)
  maxResolution: number;             // Max image dimension in px
}

// Credit costs per action (margin-safe defaults — actual model costs are in model-router.ts)
export const CREDIT_COSTS = {
  image: 5,           // Default image (Nano Banana Pro — primary model)
  imageHD: 5,         // High-quality image (Nano Banana Pro)
  imageEdit: 3,       // Image-to-image edit
  videoPerSec: 8,     // Default per second of video
  upscale: 2,
  removeBG: 2,
} as const;

export const PLAN_LIMITS: { [key: string]: PlanLimits } = {
  free: {
    plan: 'free',
    credits: 25,
    fullAppGenerations: 0,
    uiPreviews: 5,
    chats: 5,
    canIterate: true,
    studioVideoAllowed: false,
    studioBatchAllowed: false,
    studioAllModels: false,
    maxResolution: 768,
  },
  tester: {
    plan: 'tester',
    credits: 100,
    fullAppGenerations: 0,
    uiPreviews: 10,
    chats: 10,
    canIterate: true,
    studioVideoAllowed: true,
    studioBatchAllowed: true,
    studioAllModels: false,           // Gemini models only (same as basic)
    maxResolution: 1024,
  },
  basic: {
    plan: 'basic',
    credits: 1500,                    // ~300 images or ~25 videos (50% margin)
    fullAppGenerations: 0,
    uiPreviews: 10,
    chats: 20,
    canIterate: true,
    studioVideoAllowed: true,         // Veo 3.0 Fast only
    studioBatchAllowed: true,
    studioAllModels: false,           // Gemini models only
    maxResolution: 1024,
  },
  pro: {
    plan: 'pro',
    credits: 3600,                    // ~750 images or ~45 videos (50% margin)
    fullAppGenerations: 0,
    uiPreviews: 25,
    chats: 50,
    canIterate: true,
    studioVideoAllowed: true,         // All video models
    studioBatchAllowed: true,
    studioAllModels: true,            // All 13 standard models unlocked
    maxResolution: 1024,
  },
  premium: {
    plan: 'premium',
    credits: 12000,                   // ~2,400 images or ~200 videos (50% margin)
    fullAppGenerations: 5,
    uiPreviews: 50,
    chats: -1,
    canIterate: true,
    studioVideoAllowed: true,         // All video models
    studioBatchAllowed: true,
    studioAllModels: true,            // All 18+ models (incl. premium exclusives)
    maxResolution: 1536,
  },
};

export interface GenerationTracking {
  fullAppsGenerated: number;
  uiPreviewsGenerated: number;
  chatsUsed: number;
  // Credit-based studio tracking
  creditsUsed: number;               // Total credits used this month
  studioGenerations: number;         // Legacy total count
  studioImageGenerations?: number;
  studioVideoGenerations?: number;
  lastResetDate: string;
  projects: {
    [projectId: string]: {
      projectId: string;
      projectName: string;
      createdAt: string;
      lastModified: string;
      files: { [path: string]: string };
      framework: string;
      status: 'active' | 'archived';
      iterationCount?: number;
      iterationHistory?: Array<{
        timestamp: string;
        changes: {
          modified: { [path: string]: string };
          added: { [path: string]: string };
          deleted: string[];
        };
        description: string;
      }>;
    };
  };
}

/**
 * Calculate credit cost for an action
 */
export function calculateCreditCost(
  action: 'image' | 'imageHD' | 'imageEdit' | 'video' | 'upscale' | 'removeBG',
  videoDurationSec?: number,
): number {
  if (action === 'video' && videoDurationSec) {
    return Math.ceil(videoDurationSec * CREDIT_COSTS.videoPerSec);
  }
  const costMap: Record<string, number> = {
    image: CREDIT_COSTS.image,
    imageHD: CREDIT_COSTS.imageHD,
    imageEdit: CREDIT_COSTS.imageEdit,
    upscale: CREDIT_COSTS.upscale,
    removeBG: CREDIT_COSTS.removeBG,
  };
  return costMap[action] || 1;
}

/**
 * Check if user can generate a full app
 */
export function canGenerateFullApp(
  subscription: { plan: string; status: string },
  generationTracking: GenerationTracking,
): { allowed: boolean; reason?: string } {
  const plan = subscription.plan as PlanLimits['plan'];
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (subscription.status !== 'active' && plan !== 'free' && plan !== 'tester') {
    return { allowed: false, reason: 'Your subscription is not active. Please renew.' };
  }

  if (plan === 'free' || plan === 'tester' || plan === 'basic' || plan === 'pro') {
    return { allowed: false, reason: 'Full app generation requires Premium plan.' };
  }

  const used = generationTracking.fullAppsGenerated || 0;
  if (used >= limits.fullAppGenerations) {
    return { allowed: false, reason: `You've used all ${limits.fullAppGenerations} full app generations this month.` };
  }

  return { allowed: true };
}

/**
 * Check if user can generate UI preview
 */
export function canGenerateUIPreview(
  subscription: { plan: string; status: string },
  generationTracking: GenerationTracking,
): { allowed: boolean; reason?: string } {
  const plan = subscription.plan as PlanLimits['plan'];
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  const used = generationTracking.uiPreviewsGenerated || 0;
  if (used >= limits.uiPreviews) {
    return {
      allowed: false,
      reason: `You've used all ${limits.uiPreviews} UI previews this month.${plan === 'free' ? ' Upgrade to Basic ($25/mo).' : ''}`,
    };
  }

  return { allowed: true };
}

/**
 * Reset monthly generation counts if needed
 */
export function resetMonthlyCountsIfNeeded(tracking: GenerationTracking): GenerationTracking {
  const now = new Date();
  const lastReset = new Date(tracking.lastResetDate || now.toISOString());

  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    return {
      ...tracking,
      fullAppsGenerated: 0,
      uiPreviewsGenerated: 0,
      chatsUsed: 0,
      creditsUsed: 0,
      studioGenerations: 0,
      studioImageGenerations: 0,
      studioVideoGenerations: 0,
      lastResetDate: now.toISOString(),
    };
  }

  return tracking;
}

/**
 * Check if user can use the AI Studio — credit-based
 */
export function canUseStudio(
  subscription: { plan: string; status: string },
  generationTracking: GenerationTracking,
  isVideoNode: boolean = false,
  creditCost: number = 1,
): { allowed: boolean; reason?: string; remaining?: number; creditsUsed?: number; creditsTotal?: number } {
  const plan = subscription.plan as PlanLimits['plan'];
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (subscription.status !== 'active' && plan !== 'free' && plan !== 'tester') {
    return { allowed: false, reason: 'Your subscription is not active. Please renew.' };
  }

  // Video access check
  if (isVideoNode && !limits.studioVideoAllowed) {
    return {
      allowed: false,
      reason: 'Video generation requires Basic ($25/mo) or higher. Upgrade to unlock video.',
    };
  }

  // Credit check
  const used = generationTracking.creditsUsed || 0;
  const remaining = limits.credits - used;

  if (used + creditCost > limits.credits) {
    return {
      allowed: false,
      reason: `Not enough credits. You have ${remaining} credits remaining (need ${creditCost}). ${
        plan === 'free'
          ? 'Upgrade to Basic ($25/mo) for 1,500 credits.'
          : plan === 'basic'
          ? 'Upgrade to Pro ($60/mo) for 3,600 credits.'
          : plan === 'pro'
          ? 'Upgrade to Premium ($200/mo) for 12,000 credits.'
          : 'Resets next month.'
      }`,
      remaining,
      creditsUsed: used,
      creditsTotal: limits.credits,
    };
  }

  return { allowed: true, remaining, creditsUsed: used, creditsTotal: limits.credits };
}

/**
 * Check if user can use chat/iteration feature
 */
export function canUseChat(
  subscription: { plan: string; status: string },
  generationTracking: GenerationTracking,
): { allowed: boolean; reason?: string; remaining?: number } {
  const plan = subscription.plan as PlanLimits['plan'];
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (subscription.status !== 'active' && plan !== 'free' && plan !== 'tester') {
    return { allowed: false, reason: 'Your subscription is not active.' };
  }

  if (plan === 'premium' && limits.chats === -1) {
    return { allowed: true, remaining: -1 };
  }

  const used = generationTracking.chatsUsed || 0;
  const remaining = limits.chats - used;
  if (used >= limits.chats) {
    return {
      allowed: false,
      reason: `You've used all ${limits.chats} chats this month.${plan === 'free' ? ' Upgrade to Pro.' : ''}`,
      remaining: 0,
    };
  }

  return { allowed: true, remaining };
}
