import assert from 'node:assert/strict';
import test from 'node:test';
import { handleSongSectionsRequest } from './songSections.js';

test('handleSongSectionsRequest rejects videos longer than 10 minutes', async () => {
  const result = await handleSongSectionsRequest({
    videoId: 'dQw4w9WgXcQ',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    videoDuration: 601,
  });

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.status, 'error');
  assert.equal(
    result.body.message,
    'Song section detection only supports videos up to 10 minutes.',
  );
  assert.deepEqual(result.body.sections, []);
});
