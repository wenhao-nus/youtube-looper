export type SectionDetectionStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export type DetectedSongSection = {
  id: string;
  label: string;
  start: number;
  end: number;
  confidence: 'high' | 'medium' | 'low';
};

export type SongSectionsResponse = {
  status: Exclude<SectionDetectionStatus, 'idle' | 'loading'>;
  source: 'gemini';
  sections: DetectedSongSection[];
  message?: string;
};

type DetectSongSectionsOptions = {
  videoId: string;
  videoUrl: string;
  videoDuration: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function detectSongSections({
  videoId,
  videoUrl,
  videoDuration,
}: DetectSongSectionsOptions): Promise<SongSectionsResponse> {
  const response = await fetch(`${API_BASE_URL}/song-sections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoId,
      videoUrl,
      videoDuration,
    }),
  });

  const body = (await response.json()) as SongSectionsResponse;

  if (!response.ok) {
    throw new Error(body.message ?? 'Section detection failed.');
  }

  return body;
}
