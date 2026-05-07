import { useEffect, useMemo, useState } from 'react';
import { LoopControls } from './components/LoopControls';
import { PlayerPanel } from './components/PlayerPanel';
import { UrlForm } from './components/UrlForm';
import { formatEditableTime, formatTime } from './utils/time';
import { validateLoopRange, type LoopRange } from './utils/validation';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';

export function App() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [startInput, setStartInput] = useState('0:00');
  const [endInput, setEndInput] = useState('0:00');
  const [activeRange, setActiveRange] = useState<LoopRange | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [shouldAutoStartRange, setShouldAutoStartRange] = useState(false);
  const [shouldUseFullVideoRange, setShouldUseFullVideoRange] = useState(false);

  const {
    containerId,
    status,
    error,
    duration,
    currentTime,
    playbackRate,
    playLoop,
    pause,
    resume,
    seekTo,
    setPlaybackRate,
  } = useYouTubePlayer({
    videoId,
    loopRange: activeRange,
    isLooping,
  });

  const validation = useMemo(
    () => validateLoopRange(startInput, endInput, duration),
    [duration, endInput, startInput],
  );

  useEffect(() => {
    if (validation.ok) {
      setActiveRange(validation.range);

      if (
        shouldAutoStartRange &&
        videoId &&
        ['ready', 'playing', 'paused'].includes(status)
      ) {
        setIsLooping(true);
        playLoop(validation.range);
        setShouldAutoStartRange(false);
      }
    } else {
      setIsLooping(false);
    }
  }, [playLoop, shouldAutoStartRange, status, validation, videoId]);

  useEffect(() => {
    if (!shouldUseFullVideoRange || !duration) {
      return;
    }

    setStartInput('0:00');
    setEndInput(formatEditableTime(duration));
    setShouldUseFullVideoRange(false);
  }, [duration, shouldUseFullVideoRange]);

  function handleLoad(nextVideoId: string) {
    setVideoId(nextVideoId);
    setActiveRange(null);
    setIsLooping(false);
    setShouldAutoStartRange(false);
    setShouldUseFullVideoRange(true);
    setStartInput('0:00');
    setEndInput('0:00');
  }

  function handleToggleLoop() {
    if (!validation.ok) {
      return;
    }

    setActiveRange(validation.range);
    setIsLooping(true);
    playLoop(validation.range);
  }

  function handlePlaybackToggle() {
    if (status === 'paused' || status === 'ready') {
      resume();
      return;
    }

    pause();
  }

  function setStartToCurrentTime() {
    setShouldAutoStartRange(true);
    setShouldUseFullVideoRange(false);
    setStartInput(formatTime(currentTime));
  }

  function setEndToCurrentTime() {
    setShouldAutoStartRange(true);
    setShouldUseFullVideoRange(false);
    setEndInput(formatTime(currentTime));
  }

  function handleStartChange(value: string) {
    setShouldAutoStartRange(true);
    setShouldUseFullVideoRange(false);
    setStartInput(value);
  }

  function handleEndChange(value: string) {
    setShouldAutoStartRange(true);
    setShouldUseFullVideoRange(false);
    setEndInput(value);
  }

  function handleRangeSeek(percent: number) {
    if (!activeRange) {
      return;
    }

    const boundedPercent = Math.min(100, Math.max(0, percent));
    const nextTime =
      activeRange.start + (activeRange.end - activeRange.start) * (boundedPercent / 100);
    seekTo(nextTime);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>YouTube Looper</h1>
        </div>
      </header>

      <div className="layout">
        <div className="primary-column">
          <UrlForm loading={status === 'loading'} onLoad={handleLoad} />
          <PlayerPanel
            key={videoId ?? 'empty-player'}
            containerId={containerId}
            hasVideo={Boolean(videoId)}
            status={status}
            error={error}
          />
        </div>

        <aside className="side-column">
          <LoopControls
            startInput={startInput}
            endInput={endInput}
            duration={duration}
            currentTime={currentTime}
            playerStatus={status}
            validation={validation}
            activeRange={activeRange}
            playbackRate={playbackRate}
            disabled={!videoId || status === 'loading' || status === 'error'}
            onStartChange={handleStartChange}
            onEndChange={handleEndChange}
            onSetStartNow={setStartToCurrentTime}
            onSetEndNow={setEndToCurrentTime}
            onToggleLoop={handleToggleLoop}
            onPlaybackToggle={handlePlaybackToggle}
            onRangeSeek={handleRangeSeek}
            onPlaybackRateChange={setPlaybackRate}
          />
        </aside>
      </div>
    </main>
  );
}
