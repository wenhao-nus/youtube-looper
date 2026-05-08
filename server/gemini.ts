import { GoogleGenAI, MediaResolution, type GenerateContentParameters } from '@google/genai';
import { extractSectionsFromGeminiText, type SongSection } from './sectionDetection.js';

export type GeminiSectionResult =
  | {
      ok: true;
      sections: SongSection[];
      model: string;
      attemptedModels: string[];
    }
  | {
      ok: false;
      message: string;
      attemptedModels: string[];
    };

type DetectWithGeminiOptions = {
  apiKey: string;
  models: string[];
  videoUrl: string;
  videoDuration: number;
  timeoutMs: number;
  generateContent?: GenerateContent;
};

type GenerateContent = (request: GenerateContentParameters) => Promise<{ text?: string }>;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 16,
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            enum: [
              'Intro',
              'Verse',
              'Pre-Chorus',
              'Post-Chorus',
              'Chorus',
              'Bridge',
              'Instrumental',
              'Outro',
              'Section',
            ],
          },
          start: { type: 'string' },
          end: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['label', 'start', 'end', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
};

export async function detectSectionsWithGemini({
  apiKey,
  models,
  videoUrl,
  videoDuration,
  timeoutMs,
  generateContent,
}: DetectWithGeminiOptions): Promise<GeminiSectionResult> {
  const ai = generateContent ? null : new GoogleGenAI({ apiKey });
  const generate = generateContent ?? ((request) => ai!.models.generateContent(request));
  let transientError: unknown = null;
  let emptyResponseCount = 0;
  const attemptedModels: string[] = [];

  for (const model of models) {
    attemptedModels.push(model);

    try {
      const response = await generate({
        model,
        contents: [
          {
            fileData: {
              fileUri: videoUrl,
            },
          },
          {
            text: buildPrompt(videoDuration),
          },
        ],
        config: {
          candidateCount: 1,
          httpOptions: {
            timeout: timeoutMs,
          },
          maxOutputTokens: 900,
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
          temperature: 0,
          tools: [{ googleSearch: {} }],
          topP: 0.2,
        },
      });

      const text = response.text ?? '';
      const sections = extractSectionsFromGeminiText(text, videoDuration);

      if (!sections.length) {
        emptyResponseCount += 1;
        continue;
      }

      return { ok: true, sections, model, attemptedModels };
    } catch (error) {
      if (!isTransientGeminiError(error)) {
        throw error;
      }

      transientError = error;
    }
  }

  if (emptyResponseCount > 0) {
    return {
      ok: false,
      message: 'Failed to generate section timestamps for the video.',
      attemptedModels,
    };
  }

  return {
    ok: false,
    message: getTransientFailureMessage(transientError),
    attemptedModels,
  };
}

function buildPrompt(videoDuration: number): string {
  return `
Analyze this YouTube video's audio and return 4-16 major song sections.
You may return fewer than 4 sections only if you are very confident the song has fewer than 4 distinct major sections.
Use only timestamps from this exact video. Do not use studio-track assumptions.
Use the video's audio, transcript, description, and metadata. If useful, use web search to compare against reputable sources of lyrics and section structure (such as Genius, Musixmatch), studio-track transcripts, or known release metadata, but keep the timestamps aligned to this exact video.
Do not output lyrics.
Use labels: Intro, Verse, Pre-Chorus, Chorus, Post-Chorus, Bridge, Instrumental, Outro, Section.
Use Section only as a fallback when the section is musically distinct but none of the named labels fit.
Use MM:SS timestamps, clamp to 0-${Math.round(videoDuration)} seconds, and return JSON only.
Confidence must describe boundary certainty:
- high: clear audible transition and both start/end are easy to place
- medium: section is clear, but one or both boundaries are approximate
- low: section label or timing is a best guess
Do not mark every section high unless every boundary is clearly audible.
`.trim();
}

function isTransientGeminiError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getErrorText(error);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.toLowerCase().includes('unavailable') ||
    message.toLowerCase().includes('resource_exhausted') ||
    message.toLowerCase().includes('deadline_exceeded') ||
    message.toLowerCase().includes('timed out') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('high demand')
  );
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const value = error as { status?: unknown; code?: unknown };

  if (typeof value.status === 'number') {
    return value.status;
  }

  if (typeof value.code === 'number') {
    return value.code;
  }

  if (typeof value.status === 'string') {
    return mapErrorStatus(value.status);
  }

  if (typeof value.code === 'string') {
    return mapErrorStatus(value.code);
  }

  return undefined;
}

function getTransientFailureMessage(error: unknown): string {
  if (!error) {
    return 'Gemini section detection is temporarily unavailable.';
  }

  const message = getErrorText(error);

  if (message.toLowerCase().includes('high demand')) {
    return 'Gemini models are currently experiencing high demand. Please try again later.';
  }

  return 'Gemini section detection is temporarily unavailable. Please try again later.';
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const structuredText = JSON.stringify(error, Object.getOwnPropertyNames(error));
    return `${error.message} ${structuredText}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

function mapErrorStatus(status: string): number | undefined {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === 'RESOURCE_EXHAUSTED') {
    return 429;
  }

  if (normalizedStatus === 'UNAVAILABLE') {
    return 503;
  }

  if (normalizedStatus === 'DEADLINE_EXCEEDED') {
    return 504;
  }

  return undefined;
}
