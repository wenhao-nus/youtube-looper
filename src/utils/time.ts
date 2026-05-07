export function parseTimeInput(input: string): number | null {
  const value = input.trim();

  if (!value) {
    return null;
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const wholeTimeParts = parts.slice(0, -1);
  const secondsPart = parts[parts.length - 1];

  if (
    !wholeTimeParts.every((part) => /^\d+$/.test(part)) ||
    !/^\d+(?:\.\d+)?$/.test(secondsPart)
  ) {
    return null;
  }

  const numericParts = parts.map(Number);
  const seconds = numericParts[numericParts.length - 1] ?? 0;
  const minutes = numericParts[numericParts.length - 2] ?? 0;
  const hours = parts.length === 3 ? numericParts[0] : 0;

  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`;
  }

  return `${minutes}:${pad(remainingSeconds)}`;
}

export function formatEditableTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  const formattedSeconds = formatSecondsForInput(remainingSeconds);

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${padSecondsText(formattedSeconds)}`;
  }

  return `${minutes}:${padSecondsText(formattedSeconds)}`;
}

function formatSecondsForInput(seconds: number): string {
  const truncatedSeconds = Math.floor(seconds * 100) / 100;

  if (Number.isInteger(truncatedSeconds)) {
    return String(truncatedSeconds);
  }

  return truncatedSeconds.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function padSecondsText(value: string): string {
  const [wholeSeconds, fraction] = value.split('.');
  const paddedSeconds = wholeSeconds.padStart(2, '0');

  return fraction ? `${paddedSeconds}.${fraction}` : paddedSeconds;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
