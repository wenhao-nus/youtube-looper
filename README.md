# YouTube Looper

A browser-only React + Vite app for looping an exact section of a YouTube video.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL and paste a YouTube URL or video ID.

The app runs a Vite frontend and a local section-detection API. To enable AI-backed
song section detection, copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
Without a key, the app still runs and section detection returns an unavailable message.
If the configured AI model is temporarily overloaded, the API retries the comma-separated
`GEMINI_FALLBACK_MODELS` before returning an unavailable response.
Successful detections are cached with Vercel Runtime Cache by video ID and duration, with an
in-memory fallback for local development. Duplicate in-flight requests share one AI call.

## Supported inputs

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- YouTube Shorts, live, and embed URLs
- Raw 11-character YouTube video IDs

Timestamps accept seconds, `mm:ss`, or `hh:mm:ss`.

## Scripts

- `npm run dev` starts the frontend and local API.
- `npm run lint` runs ESLint.
- `npm test` runs section timestamp normalization tests.
- `npm run build` type-checks the frontend, server, Vite config, and builds the app.
