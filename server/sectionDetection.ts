export type SectionConfidence = 'high' | 'medium' | 'low';

export type SongSection = {
  id: string;
  label: string;
  start: number;
  end: number;
  confidence: SectionConfidence;
};

type RawGeminiSection = {
  label?: unknown;
  start?: unknown;
  end?: unknown;
  confidence?: unknown;
};

const MIN_SECTION_SECONDS = 4;
const SHORT_SECTION_LABELS = new Set(['intro', 'outro']);
const ALLOWED_LABELS = new Set([
  'Intro',
  'Verse',
  'Pre-Chorus',
  'Chorus',
  'Bridge',
  'Instrumental',
  'Outro',
  'Section',
]);

export function extractSectionsFromGeminiText(
  text: string,
  videoDuration: number,
): SongSection[] {
  const parsed = parseGeminiJson(text);
  const rawSections = getRawSections(parsed);

  return normalizeSections(rawSections, videoDuration);
}

export function normalizeSections(
  rawSections: RawGeminiSection[],
  videoDuration: number,
): SongSection[] {
  const maxDuration = Math.max(0, videoDuration);
  const sections = rawSections
    .map((section) => normalizeSection(section, maxDuration))
    .filter((section): section is Omit<SongSection, 'id'> => Boolean(section))
    .sort((first, second) => first.start - second.start || first.end - second.end);

  const deduped: Array<Omit<SongSection, 'id'>> = [];

  for (const section of sections) {
    const previous = deduped[deduped.length - 1];

    if (previous && section.start < previous.end) {
      continue;
    }

    if (!isLongEnough(section)) {
      continue;
    }

    deduped.push(section);
  }

  return deduped.map((section, index) => ({
    ...section,
    id: `${index + 1}-${slugify(section.label)}-${Math.round(section.start)}`,
  }));
}

export function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  if (!parts.every((part) => /^\d+(?:\.\d+)?$/.test(part))) {
    return null;
  }

  const seconds = Number(parts[parts.length - 1]);
  const minutes = Number(parts[parts.length - 2]);
  const hours = parts.length === 3 ? Number(parts[0]) : 0;

  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function parseGeminiJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function getRawSections(parsed: unknown): RawGeminiSection[] {
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const value = parsed as { sections?: unknown };
  if (!Array.isArray(value.sections)) {
    return [];
  }

  return value.sections.filter(
    (section): section is RawGeminiSection =>
      Boolean(section) && typeof section === 'object',
  );
}

function normalizeSection(
  rawSection: RawGeminiSection,
  videoDuration: number,
): Omit<SongSection, 'id'> | null {
  const start = parseTimestamp(rawSection.start);
  const end = parseTimestamp(rawSection.end);

  if (start === null || end === null) {
    return null;
  }

  const boundedStart = clamp(start, 0, videoDuration);
  const boundedEnd = clamp(end, 0, videoDuration);

  if (boundedEnd <= boundedStart) {
    return null;
  }

  const label = normalizeLabel(rawSection.label);

  return {
    label,
    start: roundSeconds(boundedStart),
    end: roundSeconds(boundedEnd),
    confidence: normalizeConfidence(rawSection.confidence),
  };
}

function normalizeLabel(value: unknown): string {
  if (typeof value !== 'string') {
    return 'Section';
  }

  const normalized = value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace('Pre Chorus', 'Pre-Chorus');

  return ALLOWED_LABELS.has(normalized) ? normalized : 'Section';
}

function normalizeConfidence(value: unknown): SectionConfidence {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function isLongEnough(section: Omit<SongSection, 'id'>): boolean {
  if (section.end - section.start >= MIN_SECTION_SECONDS) {
    return true;
  }

  return SHORT_SECTION_LABELS.has(section.label.toLowerCase());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
