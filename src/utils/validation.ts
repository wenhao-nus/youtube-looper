import { parseTimeInput } from './time';

export type LoopRange = {
  start: number;
  end: number;
};

export type RangeValidationResult =
  | { ok: true; range: LoopRange }
  | { ok: false; error: string };

export function validateLoopRange(
  startInput: string,
  endInput: string,
  duration?: number,
): RangeValidationResult {
  const start = parseTimeInput(startInput);
  const end = parseTimeInput(endInput);

  if (start === null || end === null) {
    return {
      ok: false,
      error: 'Use seconds, mm:ss, or hh:mm:ss for both timestamps.',
    };
  }

  if (start < 0 || end < 0) {
    return { ok: false, error: 'Timestamps cannot be negative.' };
  }

  if (end <= start) {
    return { ok: false, error: 'End time must be after start time.' };
  }

  if (end - start < 0.5) {
    return { ok: false, error: 'Choose a loop section of at least 0.5 seconds.' };
  }

  if (duration && start >= duration) {
    return { ok: false, error: 'Start time must be inside the video duration.' };
  }

  if (duration && end > duration) {
    return {
      ok: true,
      range: { start, end: duration },
    };
  }

  return { ok: true, range: { start, end } };
}
