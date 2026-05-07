import { AlertCircle, Loader2, MonitorPlay } from 'lucide-react';

type PlayerPanelProps = {
  containerId: string;
  hasVideo: boolean;
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';
  error: string | null;
};

export function PlayerPanel({ containerId, hasVideo, status, error }: PlayerPanelProps) {
  return (
    <section className="player-panel" aria-label="YouTube player">
      <div className="video-frame">
        <div id={containerId} />
        {!hasVideo ? (
          <div className="player-state">
            <MonitorPlay size={44} />
            <h2>No video loaded</h2>
            <p>Paste a YouTube link to choose and loop a precise section.</p>
          </div>
        ) : null}
        {status === 'loading' ? (
          <div className="player-state overlay">
            <Loader2 className="spin" size={36} />
            <h2>Loading video</h2>
          </div>
        ) : null}
        {status === 'error' ? (
          <div className="player-state overlay error-state">
            <AlertCircle size={36} />
            <h2>Could not load video</h2>
            <p>{error}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
