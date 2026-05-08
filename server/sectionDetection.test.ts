import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractSectionsFromGeminiText,
  normalizeSections,
  parseTimestamp,
} from './sectionDetection.js';

test('parseTimestamp supports seconds and clock formats', () => {
  assert.equal(parseTimestamp(33), 33);
  assert.equal(parseTimestamp('0:33'), 33);
  assert.equal(parseTimestamp('1:02:03.5'), 3723.5);
  assert.equal(parseTimestamp('1:70'), null);
});

test('normalizeSections clamps, sorts, labels, and ids sections', () => {
  const sections = normalizeSections(
    [
      { label: 'chorus', start: '0:33', end: '0:50', confidence: 'high' },
      { label: 'unknown', start: '0:05', end: '0:30', confidence: 'medium' },
      { label: 'verse', start: '0:29', end: '0:35', confidence: 'high' },
      { label: 'bridge', start: '2:10', end: '2:40', confidence: 'high' },
    ],
    120,
  );

  assert.deepEqual(
    sections.map((section) => [section.label, section.start, section.end, section.confidence]),
    [
      ['Section', 5, 30, 'medium'],
      ['Chorus', 33, 50, 'high'],
    ],
  );
  assert.equal(sections[0].id, '1-section-5');
});

test('extractSectionsFromGeminiText reads fenced JSON responses', () => {
  const sections = extractSectionsFromGeminiText(
    '```json\n{"sections":[{"label":"Intro","start":"0:01","end":"0:03","confidence":"low"}]}\n```',
    20,
  );

  assert.deepEqual(sections[0], {
    id: '1-intro-1',
    label: 'Intro',
    start: 1,
    end: 3,
    confidence: 'low',
  });
});
