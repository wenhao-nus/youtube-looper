import assert from 'node:assert/strict';
import test from 'node:test';
import { detectSectionsWithGemini } from './gemini.js';

const VALID_RESPONSE = JSON.stringify({
  sections: [
    {
      label: 'Intro',
      start: '0:00',
      end: '0:10',
      confidence: 'high',
    },
    {
      label: 'Chorus',
      start: '0:10',
      end: '0:30',
      confidence: 'medium',
    },
  ],
});

test('detectSectionsWithGemini tries fallback model after high demand error', async () => {
  const attemptedModels: string[] = [];

  const result = await detectSectionsWithGemini({
    apiKey: 'test-key',
    models: ['primary-model', 'fallback-model'],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: 30,
    timeoutMs: 1000,
    generateContent: async ({ model }) => {
      attemptedModels.push(model);

      if (model === 'primary-model') {
        const error = new Error('This model is currently experiencing high demand.');
        Object.assign(error, { status: 'UNAVAILABLE' });
        throw error;
      }

      return { text: VALID_RESPONSE };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(attemptedModels, ['primary-model', 'fallback-model']);

  if (result.ok) {
    assert.equal(result.model, 'fallback-model');
    assert.deepEqual(result.attemptedModels, ['primary-model', 'fallback-model']);
    assert.equal(result.sections.length, 2);
  }
});

test('detectSectionsWithGemini enables Google Search grounding', async () => {
  let tools: unknown;

  const result = await detectSectionsWithGemini({
    apiKey: 'test-key',
    models: ['primary-model'],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: 30,
    timeoutMs: 1000,
    generateContent: async ({ config }) => {
      tools = config?.tools;
      return { text: VALID_RESPONSE };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(tools, [{ googleSearch: {} }]);
});

test('detectSectionsWithGemini tries fallback model after timeout-style error', async () => {
  const attemptedModels: string[] = [];

  const result = await detectSectionsWithGemini({
    apiKey: 'test-key',
    models: ['primary-model', 'fallback-model'],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: 30,
    timeoutMs: 1000,
    generateContent: async ({ model }) => {
      attemptedModels.push(model);

      if (model === 'primary-model') {
        const error = new Error('Request timed out.');
        Object.assign(error, { code: 'DEADLINE_EXCEEDED' });
        throw error;
      }

      return { text: VALID_RESPONSE };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(attemptedModels, ['primary-model', 'fallback-model']);

  if (result.ok) {
    assert.equal(result.model, 'fallback-model');
  }
});

test('detectSectionsWithGemini tries fallback model after message-only timeout error', async () => {
  const attemptedModels: string[] = [];

  const result = await detectSectionsWithGemini({
    apiKey: 'test-key',
    models: ['primary-model', 'fallback-model'],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: 30,
    timeoutMs: 1000,
    generateContent: async ({ model }) => {
      attemptedModels.push(model);

      if (model === 'primary-model') {
        throw new Error('Request timeout while waiting for model response.');
      }

      return { text: VALID_RESPONSE };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(attemptedModels, ['primary-model', 'fallback-model']);

  if (result.ok) {
    assert.equal(result.model, 'fallback-model');
  }
});

test('detectSectionsWithGemini reports all attempted models when all are overloaded', async () => {
  const result = await detectSectionsWithGemini({
    apiKey: 'test-key',
    models: ['primary-model', 'fallback-model'],
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: 30,
    timeoutMs: 1000,
    generateContent: async () => {
      const error = new Error('This model is currently experiencing high demand.');
      Object.assign(error, { status: 503 });
      throw error;
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.attemptedModels, ['primary-model', 'fallback-model']);

  if (!result.ok) {
    assert.equal(
      result.message,
      'Gemini models are currently experiencing high demand. Please try again later.',
    );
  }
});
