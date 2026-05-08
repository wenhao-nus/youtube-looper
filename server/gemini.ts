import { GoogleGenAI, MediaResolution } from '@google/genai';
import { extractSectionsFromGeminiText, type SongSection } from './sectionDetection.js';

export type GeminiSectionResult =
  | {
      ok: true;
      sections: SongSection[];
      model: string;
    }
  | {
      ok: false;
      message: string;
    };

type DetectWithGeminiOptions = {
  apiKey: string;
  models: string[];
  videoUrl: string;
  videoDuration: number;
  timeoutMs: number;
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            enum: [
              'Intro',
              'Verse',
              'Pre-Chorus',
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
}: DetectWithGeminiOptions): Promise<GeminiSectionResult> {
  const ai = new GoogleGenAI({ apiKey });
  let transientError: unknown = null;
  let emptyResponseCount = 0;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
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
          topP: 0.2,
        },
      });

      const text = response.text ?? '';
      const sections = extractSectionsFromGeminiText(text, videoDuration);

      if (!sections.length) {
        emptyResponseCount += 1;
        continue;
      }

      return { ok: true, sections, model };
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
    };
  }

  return {
    ok: false,
    message: getTransientFailureMessage(transientError),
  };
}

function buildPrompt(videoDuration: number): string {
  return `
Analyze this YouTube video's audio and return 4-10 major song sections.
Use only timestamps from this exact video. Do not use studio-track assumptions.
Use labels: Intro, Verse, Pre-Chorus, Chorus, Bridge, Instrumental, Outro, Section.
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
  const message = error instanceof Error ? error.message : String(error);

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('UNAVAILABLE') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('high demand')
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

  return undefined;
}

function getTransientFailureMessage(error: unknown): string {
  if (!error) {
    return 'Gemini section detection is temporarily unavailable.';
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('high demand')) {
    return 'Gemini models are currently experiencing high demand. Please try again later.';
  }

  return 'Gemini section detection is temporarily unavailable. Please try again later.';
}
