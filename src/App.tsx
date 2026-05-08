import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetectedSections } from './components/DetectedSections';
import { LoopControls } from './components/LoopControls';
import { PlayerPanel } from './components/PlayerPanel';
import { UrlForm } from './components/UrlForm';
import { formatEditableTime, formatTime } from './utils/time';
import { validateLoopRange, type LoopRange } from './utils/validation';
import { useYouTubePlayer } from './hooks/useYouTubePlayer';
import {
  MAX_SECTION_DETECTION_SECONDS,
  VIDEO_TOO_LONG_MESSAGE,
  detectSongSections,
  type DetectedSongSection,
  type SectionDetectionStatus,
} from './lib/songSections';

export function App() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [startInput, setStartInput] = useState('0:00');
  const [endInput, setEndInput] = useState('0:00');
  const [activeRange, setActiveRange] = useState<LoopRange | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [shouldAutoStartRange, setShouldAutoStartRange] = useState(false);
  const [shouldUseFullVideoRange, setShouldUseFullVideoRange] = useState(false);
  const [sectionDetectionStatus, setSectionDetectionStatus] =
    useState<SectionDetectionStatus>('idle');
  const [detectedSections, setDetectedSections] = useState<DetectedSongSection[]>([]);
  const [sectionDetectionMessage, setSectionDetectionMessage] = useState<string | null>(null);
  const [autoDetectionKey, setAutoDetectionKey] = useState<string | null>(null);
  const detectionRequestIdRef = useRef(0);

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
  const isSectionDetectionTooLong =
    typeof duration === 'number' && duration > MAX_SECTION_DETECTION_SECONDS;
  const selectedSectionId = useMemo(() => {
    if (!validation.ok) {
      return null;
    }

    const selectedSection = detectedSections.find(
      (section) =>
        areTimesEqual(section.start, validation.range.start) &&
        areTimesEqual(section.end, validation.range.end),
    );

    return selectedSection?.id ?? null;
  }, [detectedSections, validation]);

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

  useEffect(() => {
    if (!videoId || !duration) {
      return;
    }

    if (!isSectionDetectionTooLong) {
      if (sectionDetectionMessage === VIDEO_TOO_LONG_MESSAGE) {
        setSectionDetectionStatus('idle');
        setSectionDetectionMessage(null);
      }
      return;
    }

    setSectionDetectionStatus('error');
    setDetectedSections([]);
    setSectionDetectionMessage(VIDEO_TOO_LONG_MESSAGE);
  }, [duration, isSectionDetectionTooLong, sectionDetectionMessage, videoId]);

  const runSectionDetection = useCallback(async (requestVideoId: string, requestDuration: number) => {
    if (requestDuration > MAX_SECTION_DETECTION_SECONDS) {
      setSectionDetectionStatus('error');
      setDetectedSections([]);
      setSectionDetectionMessage(VIDEO_TOO_LONG_MESSAGE);
      return;
    }

    const requestId = detectionRequestIdRef.current + 1;
    detectionRequestIdRef.current = requestId;
    setSectionDetectionStatus('loading');
    setSectionDetectionMessage(null);

    try {
      const result = await detectSongSections({
        videoId: requestVideoId,
        videoUrl: getWatchUrl(requestVideoId),
        videoDuration: requestDuration,
      });

      if (detectionRequestIdRef.current !== requestId) {
        return;
      }

      setDetectedSections(result.sections);
      setSectionDetectionStatus(result.status);
      setSectionDetectionMessage(result.message ?? null);
    } catch (error) {
      if (detectionRequestIdRef.current !== requestId) {
        return;
      }

      setDetectedSections([]);
      setSectionDetectionStatus('error');
      setSectionDetectionMessage(
        error instanceof Error ? error.message : 'Section detection failed.',
      );
    }
  }, []);

  useEffect(() => {
    if (
      !videoId ||
      !duration ||
      isSectionDetectionTooLong ||
      sectionDetectionStatus !== 'idle' ||
      !['ready', 'playing', 'paused'].includes(status)
    ) {
      return;
    }

    const nextAutoDetectionKey = `${videoId}:${Math.round(duration)}`;

    if (autoDetectionKey === nextAutoDetectionKey) {
      return;
    }

    setAutoDetectionKey(nextAutoDetectionKey);
    void runSectionDetection(videoId, duration);
  }, [
    autoDetectionKey,
    duration,
    isSectionDetectionTooLong,
    runSectionDetection,
    sectionDetectionStatus,
    status,
    videoId,
  ]);

  function handleLoad(nextVideoId: string) {
    detectionRequestIdRef.current += 1;
    setVideoId(nextVideoId);
    setActiveRange(null);
    setIsLooping(false);
    setShouldAutoStartRange(false);
    setShouldUseFullVideoRange(true);
    setSectionDetectionStatus('idle');
    setDetectedSections([]);
    setSectionDetectionMessage(null);
    setAutoDetectionKey(null);
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

  function handleSelectSection(section: DetectedSongSection) {
    const nextStart = formatEditableTime(section.start);
    const nextEnd = formatEditableTime(section.end);
    const nextValidation = validateLoopRange(nextStart, nextEnd, duration);

    if (!nextValidation.ok) {
      setSectionDetectionStatus('error');
      setSectionDetectionMessage(nextValidation.error);
      return;
    }

    setShouldAutoStartRange(false);
    setShouldUseFullVideoRange(false);
    setStartInput(nextStart);
    setEndInput(nextEnd);
    setActiveRange(nextValidation.range);
    setIsLooping(true);
    playLoop(nextValidation.range);
  }

  async function handleDetectSections() {
    if (!videoId || !duration) {
      return;
    }

    await runSectionDetection(videoId, duration);
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
          <DetectedSections
            status={sectionDetectionStatus}
            sections={detectedSections}
            selectedSectionId={selectedSectionId}
            message={sectionDetectionMessage}
            disabled={
              !videoId ||
              !duration ||
              isSectionDetectionTooLong ||
              status === 'loading' ||
              status === 'error'
            }
            onDetect={handleDetectSections}
            onSelectSection={handleSelectSection}
          />
        </aside>
      </div>
    </main>
  );
}

function getWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function areTimesEqual(first: number, second: number): boolean {
  return Math.abs(first - second) < 0.01;
}
