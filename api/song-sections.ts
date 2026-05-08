import { handleSongSectionsRequest } from '../server/songSections';

type VercelRequestLike = {
  method?: string;
  body?: unknown;
};

type VercelResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => {
    json: (body: unknown) => void;
    end: () => void;
  };
  json: (body: unknown) => void;
  end: () => void;
};

export default async function handler(
  request: VercelRequestLike,
  response: VercelResponseLike,
) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  const result = await handleSongSectionsRequest(request.body);
  response.status(result.statusCode).json(result.body);
}
