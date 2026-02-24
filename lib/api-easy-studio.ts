/**
 * API-Easy client for Studio image/video generation.
 *
 * This module intentionally does NOT call Google's direct Gemini/Veo APIs.
 * All requests route through API-Easy (OpenAI-compatible endpoints).
 */

function getApiEasyApiKey(): string {
  const key = process.env.API_EASY_API_KEY || process.env.APIYI_API_KEY;
  if (!key) {
    throw new Error('API_EASY_API_KEY is not set');
  }
  return key;
}

function getApiEasyBaseUrl(): string {
  return process.env.API_EASY_BASE_URL || process.env.APIYI_BASE_URL || 'https://api.apiyi.com/v1';
}

function getApiEasyImageModel(): string {
  return process.env.API_EASY_IMAGE_MODEL || process.env.APIYI_IMAGE_MODEL || 'nano-banana-pro';
}

function getApiEasyVideoModel(): string {
  return process.env.API_EASY_VIDEO_MODEL || process.env.APIYI_VIDEO_MODEL || 'veo-3.1-fast';
}

export interface ApiEasyImageOptions {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  inputImageUrl?: string;
  inputImageUrls?: string[];
}

export interface ApiEasyImageResult {
  images: string[];
  text?: string;
}

export async function generateApiEasyImage(options: ApiEasyImageOptions): Promise<ApiEasyImageResult> {
  const { prompt, aspectRatio, imageSize, inputImageUrl, inputImageUrls } = options;

  const apiKey = getApiEasyApiKey();
  const baseUrl = getApiEasyBaseUrl();
  const model = options.model || getApiEasyImageModel();

  let fullPrompt = prompt;
  if (aspectRatio) fullPrompt += `\n\nAspect ratio: ${aspectRatio}`;
  if (imageSize) fullPrompt += `\nImage size preference: ${imageSize}`;

  const contentParts: Array<Record<string, unknown>> = [{ type: 'text', text: fullPrompt }];

  const allImageUrls: string[] = [];
  if (inputImageUrls && inputImageUrls.length > 0) allImageUrls.push(...inputImageUrls);
  else if (inputImageUrl) allImageUrls.push(inputImageUrl);

  for (const imageUrl of allImageUrls) {
    contentParts.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  const body = {
    model,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.8,
    max_tokens: 4096,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = err?.error?.message || err?.message || `API-Easy image error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return parseApiEasyImageResponse(data as Record<string, unknown>);
}

function parseApiEasyImageResponse(data: Record<string, unknown>): ApiEasyImageResult {
  const result: ApiEasyImageResult = { images: [] };
  const choices = (data as any)?.choices;
  if (!choices?.length) return result;

  const message = choices[0]?.message;
  if (!message) return result;

  const content = message.content;

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'text' && part.text) {
        result.text = part.text;
        extractBase64Images(part.text, result.images);
      } else if (part.type === 'image_url' && part.image_url?.url) {
        result.images.push(part.image_url.url);
      } else if (part.type === 'image' && part.image_url?.url) {
        result.images.push(part.image_url.url);
      }
    }
    return result;
  }

  if (typeof content === 'string') {
    result.text = content;
    extractBase64Images(content, result.images);

    const mdImageRegex = /!\[.*?\]\((data:image\/[^)]+)\)/g;
    let match;
    while ((match = mdImageRegex.exec(content)) !== null) {
      if (!result.images.includes(match[1])) result.images.push(match[1]);
    }

    const urlRegex = /(https?:\/\/[^\s"']+\.(?:png|jpg|jpeg|webp|gif))/gi;
    while ((match = urlRegex.exec(content)) !== null) {
      if (!result.images.includes(match[1])) result.images.push(match[1]);
    }
  }

  return result;
}

function extractBase64Images(text: string, images: string[]): void {
  const b64Regex = /(data:image\/[\w+.-]+;base64,[A-Za-z0-9+/=]+)/g;
  let match;
  while ((match = b64Regex.exec(text)) !== null) {
    if (!images.includes(match[1])) images.push(match[1]);
  }
}

export interface ApiEasyVideoOptions {
  prompt: string;
  model?: string;
  aspectRatio?: '16:9' | '9:16';
  durationSeconds?: number;
  imageUrl?: string | null;
}

export interface ApiEasyOperationResult {
  operationName: string;
}

export interface ApiEasyPollResult {
  done: boolean;
  videoUri?: string;
  error?: string;
}

export async function startApiEasyVideoGeneration(
  options: ApiEasyVideoOptions,
): Promise<ApiEasyOperationResult> {
  const { prompt, aspectRatio = '16:9', durationSeconds = 8, imageUrl } = options;

  const apiKey = getApiEasyApiKey();
  const baseUrl = getApiEasyBaseUrl();
  const model = options.model || getApiEasyVideoModel();

  const contentParts: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `Generate a ${durationSeconds}-second video in ${aspectRatio} aspect ratio.\n\n${prompt}`,
    },
  ];

  if (imageUrl) {
    contentParts.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  const body = {
    model,
    messages: [{ role: 'user', content: contentParts }],
    temperature: 0.7,
    max_tokens: 4096,
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    const msg = err?.error?.message || err?.message || `API-Easy video error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const message = (data as any)?.choices?.[0]?.message;
  const content = message?.content;
  const videoUrl = extractVideoUrl(content) || extractVideoUrl(data as any);

  if (videoUrl) return { operationName: `api_easy_complete:${videoUrl}` };

  const jobId = (data as any)?.id || (data as any)?.job_id || (data as any)?.operation;
  if (jobId) return { operationName: `api_easy_job:${jobId}` };

  throw new Error('API-Easy did not return a video URL or job ID');
}

function extractVideoUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    // Prefer explicit video-like URLs first.
    const videoLike =
      value.match(/(https?:\/\/[^\s"')]+(?:\.mp4|\.webm|\.mov)(?:\?[^\s"')]*)?)/i)?.[1] ||
      value.match(/(https?:\/\/[^\s"')]+(?:video|download|file)[^\s"')]*)/i)?.[1] ||
      null;
    if (videoLike) return videoLike;

    // Fallback: any https URL.
    const anyUrl = value.match(/(https?:\/\/[^\s"')]+)/i)?.[1] || null;
    return anyUrl;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const fromItem = extractVideoUrl(item);
      if (fromItem) return fromItem;
    }
    return null;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const directKeys = [
      'video_url',
      'videoUrl',
      'output_url',
      'outputUrl',
      'url',
      'file_url',
      'download_url',
    ];
    for (const key of directKeys) {
      const candidate = obj[key];
      if (typeof candidate === 'string' && candidate.startsWith('http')) return candidate;
    }

    // OpenAI-compatible content blocks: { type: 'video_url', video_url: { url: ... } }
    const nestedBlock =
      (obj.video_url as any)?.url ||
      (obj.video as any)?.url ||
      (obj.output as any)?.url ||
      null;
    if (typeof nestedBlock === 'string' && nestedBlock.startsWith('http')) return nestedBlock;

    // Try common containers recursively.
    const containerKeys = ['content', 'data', 'result', 'output', 'outputs', 'choices', 'message'];
    for (const key of containerKeys) {
      const nested = obj[key];
      const fromNested = extractVideoUrl(nested);
      if (fromNested) return fromNested;
    }
  }

  return null;
}

export async function pollApiEasyOperation(operationName: string): Promise<ApiEasyPollResult> {
  if (operationName.startsWith('api_easy_complete:') || operationName.startsWith('apiyi_complete:')) {
    const videoUri = operationName.includes('api_easy_complete:')
      ? operationName.slice('api_easy_complete:'.length)
      : operationName.slice('apiyi_complete:'.length);
    return { done: true, videoUri };
  }

  if (operationName.startsWith('api_easy_job:') || operationName.startsWith('apiyi_job:')) {
    const jobId = operationName.includes('api_easy_job:')
      ? operationName.slice('api_easy_job:'.length)
      : operationName.slice('apiyi_job:'.length);
    return pollApiEasyJob(jobId);
  }

  // Fallback: treat unknown value as a job ID.
  return pollApiEasyJob(operationName);
}

async function pollApiEasyJob(jobId: string): Promise<ApiEasyPollResult> {
  const apiKey = getApiEasyApiKey();
  const baseUrl = getApiEasyBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) return { done: false, error: `API-Easy poll failed: ${res.status}` };

    const data = await res.json();
    const status = String((data as any)?.status || '').toLowerCase();
    const videoUri = extractVideoUrl(data as any);

    if ((status === 'completed' || status === 'succeeded' || status === 'success') && videoUri) {
      return { done: true, videoUri };
    }

    if (status === 'failed' || status === 'error') {
      return { done: true, error: data.error || 'Video generation failed' };
    }

    return { done: false };
  } catch {
    return { done: false, error: 'API-Easy poll network error' };
  }
}

export async function downloadApiEasyVideo(videoUri: string): Promise<Buffer> {
  const res = await fetch(videoUri, { redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
