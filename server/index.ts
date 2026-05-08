import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { handleSongSectionsRequest } from './songSections.js';

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/song-sections', async (request, response) => {
  const result = await handleSongSectionsRequest(request.body);
  response.status(result.statusCode).json(result.body);
});

app.listen(port, () => {
  console.log(`Section detection API listening on http://localhost:${port}`);
});
