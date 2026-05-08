type VercelResponseLike = {
  json: (body: unknown) => void;
};

export default function handler(_request: unknown, response: VercelResponseLike) {
  response.json({ ok: true });
}
