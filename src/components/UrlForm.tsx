import { FormEvent, useState } from 'react';
import { Link, Loader2 } from 'lucide-react';
import { parseYouTubeUrl } from '../utils/youtube';

type UrlFormProps = {
  loading: boolean;
  onLoad: (videoId: string, startSeconds?: number) => void;
};

export function UrlForm({ loading, onLoad }: UrlFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseYouTubeUrl(value);

    if (!parsed) {
      setError('Paste a valid YouTube watch, share, Shorts, live, embed URL, or video ID.');
      return;
    }

    setError(null);
    onLoad(parsed.videoId, parsed.startSeconds);
  }

  return (
    <form className="panel url-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="youtube-url">YouTube URL</label>
      <div className="input-row">
        <div className="input-with-icon">
          <Link aria-hidden="true" size={18} />
          <input
            id="youtube-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'youtube-url-error' : undefined}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : null}
          Load video
        </button>
      </div>
      {error ? (
        <p className="field-message error" id="youtube-url-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
