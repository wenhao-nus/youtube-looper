import { z } from 'zod';
import { getCachedValue, setCachedValue } from './cache.js';
import { detectSectionsWithGemini } from './gemini.js';
import type { SongSection } from './sectionDetection.js';

const geminiModels = getGeminiModels();
const geminiTimeoutMs = getGeminiTimeoutMs();
const sectionCacheTtlSeconds = getSectionCacheTtlSeconds();
const detectionCooldownMs = getDetectionCooldownMs();
const inFlightRequests = new Map<string, Promise<SongSectionsResponse>>();
const recentRequests = new Map<string, number>();
const MAX_SECTION_DETECTION_SECONDS = 10 * 60;
const VIDEO_TOO_LONG_MESSAGE = 'Song section detection only supports videos up to 10 minutes.';

const requestSchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/),
  videoUrl: z.string().url().refine(isYouTubeUrl),
  videoDuration: z.number().positive().max(60 * 60 * 3),
});

export type SongSectionsResponse = {
  status: 'ready' | 'unavailable' | 'error';
  source: 'gemini';
  sections: SongSection[];
  model?: string;
  attemptedModels?: string[];
  message?: string;
};

export type SongSectionsHandlerResult = {
  statusCode: number;
  body: SongSectionsResponse;
};

export async function handleSongSectionsRequest(
  requestBody: unknown,
): Promise<SongSectionsHandlerResult> {
  const parsed = requestSchema.safeParse(parseRequestBody(requestBody));

  if (!parsed.success) {
    return {
      statusCode: 400,
      body: {
        status: 'error',
        source: 'gemini',
        sections: [],
        message: 'Invalid section detection request.',
      },
    };
  }

  const { videoId, videoUrl, videoDuration } = parsed.data;

  if (videoDuration > MAX_SECTION_DETECTION_SECONDS) {
    return {
      statusCode: 400,
      body: {
        status: 'error',
        source: 'gemini',
        sections: [],
        message: VIDEO_TOO_LONG_MESSAGE,
      },
    };
  }

  const cacheKey = getCacheKey(videoId, videoDuration);
  const cached = await getCachedValue<SongSectionsResponse>(cacheKey);

  if (cached) {
    return { statusCode: 200, body: cached };
  }

  const inFlightRequest = inFlightRequests.get(cacheKey);

  if (inFlightRequest) {
    const body = await inFlightRequest;
    return { statusCode: getResponseStatusCode(body), body };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      body: unavailable('Add GEMINI_API_KEY to enable Gemini section detection.'),
    };
  }

  if (isRateLimited(videoId)) {
    return {
      statusCode: 429,
      body: unavailable('Please wait before detecting sections again.'),
    };
  }

  const detectionRequest = runDetection({
    apiKey,
    videoUrl,
    videoDuration,
  }).finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, detectionRequest);

  const body = await detectionRequest;

  if (body.status === 'ready') {
    await setCachedValue(cacheKey, body, {
      name: `Song sections for ${videoId}`,
      tags: ['song-sections', `video:${videoId}`],
      ttlSeconds: sectionCacheTtlSeconds,
    });
  }

  return { statusCode: getResponseStatusCode(body), body };
}

async function runDetection({
  apiKey,
  videoUrl,
  videoDuration,
}: {
  apiKey: string;
  videoUrl: string;
  videoDuration: number;
}): Promise<SongSectionsResponse> {
  try {
    const result = await detectSectionsWithGemini({
      apiKey,
      models: geminiModels,
      videoUrl,
      videoDuration,
      timeoutMs: geminiTimeoutMs,
    });

    if (!result.ok) {
      return unavailable(result.message, result.attemptedModels);
    }

    return {
      status: 'ready',
      source: 'gemini',
      sections: result.sections,
      model: result.model,
      attemptedModels: result.attemptedModels,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini section detection failed.';
    return {
      status: 'error',
      source: 'gemini',
      sections: [],
      message,
    };
  }
}

function unavailable(message: string, attemptedModels?: string[]): SongSectionsResponse {
  return {
    status: 'unavailable',
    source: 'gemini',
    sections: [],
    attemptedModels,
    message,
  };
}

function parseRequestBody(requestBody: unknown): unknown {
  if (typeof requestBody !== 'string') {
    return requestBody;
  }

  try {
    return JSON.parse(requestBody);
  } catch {
    return requestBody;
  }
}

function getResponseStatusCode(body: SongSectionsResponse): number {
  return body.status === 'error' ? 502 : 200;
}

function isRateLimited(videoId: string): boolean {
  const now = Date.now();
  const lastRequest = recentRequests.get(videoId);
  recentRequests.set(videoId, now);

  return Boolean(lastRequest && now - lastRequest < detectionCooldownMs);
}

function isYouTubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  } catch {
    return false;
  }
}

function getGeminiModels(): string[] {
  const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  const configuredFallbacks = process.env.GEMINI_FALLBACK_MODELS?.split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const fallbackModels = configuredFallbacks?.length
    ? configuredFallbacks
    : ['gemini-2.5-flash-lite'];
  const models = [primaryModel, ...fallbackModels];

  return Array.from(new Set(models));
}

function getGeminiTimeoutMs(): number {
  const configuredTimeout = Number(process.env.GEMINI_MODEL_TIMEOUT_MS);

  if (Number.isFinite(configuredTimeout) && configuredTimeout >= 5_000) {
    return configuredTimeout;
  }

  return 45_000;
}

function getSectionCacheTtlSeconds(): number {
  const configuredTtl = Number(process.env.SECTION_CACHE_TTL_SECONDS);

  if (Number.isFinite(configuredTtl) && configuredTtl > 0) {
    return configuredTtl;
  }

  return 60 * 60 * 24 * 30;
}

function getDetectionCooldownMs(): number {
  const configuredCooldownSeconds = Number(process.env.DETECTION_COOLDOWN_SECONDS);

  if (Number.isFinite(configuredCooldownSeconds) && configuredCooldownSeconds >= 0) {
    return configuredCooldownSeconds * 1000;
  }

  return 5_000;
}

function getCacheKey(videoId: string, videoDuration: number): string {
  return `${videoId}:${Math.round(videoDuration)}`;
}
