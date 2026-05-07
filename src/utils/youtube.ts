export type ParsedYouTubeUrl = {
  videoId: string;
  startSeconds?: number;
};

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  const value = input.trim();

  if (VIDEO_ID_PATTERN.test(value)) {
    return { videoId: value };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v');
    } else if (
      url.pathname.startsWith('/embed/') ||
      url.pathname.startsWith('/shorts/') ||
      url.pathname.startsWith('/live/')
    ) {
      videoId = url.pathname.split('/').filter(Boolean)[1] ?? null;
    }
  }

  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) {
    return null;
  }

  const rawStart = url.searchParams.get('t') ?? url.searchParams.get('start');
  const startSeconds = rawStart ? parseYouTubeTimeParam(rawStart) : undefined;

  return { videoId, startSeconds };
}

function parseYouTubeTimeParam(value: string): number | undefined {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!match) {
    return undefined;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;

  return total > 0 ? total : undefined;
}
