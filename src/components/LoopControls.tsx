import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { Pause, Play } from 'lucide-react';
import { formatTime } from '../utils/time';
import type { LoopRange, RangeValidationResult } from '../utils/validation';

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

const FINE_SPEED_OPTIONS = Array.from({ length: 36 }, (_, index) =>
  Number((0.25 + index * 0.05).toFixed(2)),
);
const SPEED_PRESETS = [0.25, 0.5, 0.75, 1];
const SPEED_SWITCH_MARGIN = 0.1;

type LoopControlsProps = {
  startInput: string;
  endInput: string;
  duration?: number;
  currentTime: number;
  playerStatus: PlayerStatus;
  validation: RangeValidationResult;
  activeRange: LoopRange | null;
  playbackRate: number;
  disabled: boolean;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onSetStartNow: () => void;
  onSetEndNow: () => void;
  onToggleLoop: () => void;
  onPlaybackToggle: () => void;
  onRangeSeek: (percent: number) => void;
  onPlaybackRateChange: (rate: number) => void;
};

export function LoopControls({
  startInput,
  endInput,
  duration,
  currentTime,
  playerStatus,
  validation,
  activeRange,
  playbackRate,
  disabled,
  onStartChange,
  onEndChange,
  onSetStartNow,
  onSetEndNow,
  onToggleLoop,
  onPlaybackToggle,
  onRangeSeek,
  onPlaybackRateChange,
}: LoopControlsProps) {
  const draggedSpeedIndexRef = useRef<number | null>(null);
  const isSpeedDraggingRef = useRef(false);
  const speedPointerTypeRef = useRef<string | null>(null);
  const canLoop = !disabled && validation.ok;
  const showValidationError = !disabled && !validation.ok;
  const playbackLabel =
    playerStatus === 'playing' ? 'Pause' : playerStatus === 'paused' ? 'Resume' : 'Play';
  const visibleSpeedPresets = SPEED_PRESETS;
  const activeSpeedIndex = findClosestSpeedIndex(playbackRate);
  const progress =
    activeRange && activeRange.end > activeRange.start
      ? ((currentTime - activeRange.start) / (activeRange.end - activeRange.start)) * 100
      : 0;
  const boundedProgress = Math.min(100, Math.max(0, progress));
  const speedProgress =
    FINE_SPEED_OPTIONS.length > 1
      ? (activeSpeedIndex / (FINE_SPEED_OPTIONS.length - 1)) * 100
      : 0;
  const summaryEndTime = validation.ok ? validation.range.end : duration;

  function handleLoopPointerDown(event: PointerEvent<HTMLInputElement>) {
    if (disabled || !activeRange || !validation.ok) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    seekLoopFromPointer(event);
  }

  function handleLoopPointerMove(event: PointerEvent<HTMLInputElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    seekLoopFromPointer(event);
  }

  function handleSpeedPointerDown(event: PointerEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    isSpeedDraggingRef.current = true;
    speedPointerTypeRef.current = event.pointerType;
    draggedSpeedIndexRef.current = activeSpeedIndex;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSpeedFromPointer(event, true);
  }

  function handleSpeedPointerMove(event: PointerEvent<HTMLInputElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    setSpeedFromPointer(event);
  }

  function handlePointerEnd(event: PointerEvent<HTMLInputElement>) {
    isSpeedDraggingRef.current = false;
    speedPointerTypeRef.current = null;
    draggedSpeedIndexRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function seekLoopFromPointer(event: PointerEvent<HTMLInputElement>) {
    onRangeSeek(getPointerPercent(event));
  }

  function setSpeedFromPointer(
    event: PointerEvent<HTMLInputElement>,
    forceNearest = false,
  ) {
    const rawIndex = getPointerIndex(event, FINE_SPEED_OPTIONS.length);
    const currentIndex = draggedSpeedIndexRef.current ?? activeSpeedIndex;
    const nextIndex = forceNearest
      ? Math.round(rawIndex)
      : getStableSpeedIndex(rawIndex, currentIndex);
    const boundedIndex = Math.min(FINE_SPEED_OPTIONS.length - 1, Math.max(0, nextIndex));
    if (boundedIndex === currentIndex) {
      return;
    }

    draggedSpeedIndexRef.current = boundedIndex;
    onPlaybackRateChange(FINE_SPEED_OPTIONS[boundedIndex]);
  }

  return (
    <section className="panel controls" aria-labelledby="loop-controls-title">
      <h2 className="visually-hidden" id="loop-controls-title">
        Loop controls
      </h2>

      <p className="input-help">
        Enter the exact start and end timestamp you want to loop over. You can type plain seconds
        like <strong>90</strong>, minutes and seconds like <strong>1:30</strong>, or hours, minutes,
        and seconds like <strong>1:02:30</strong>.
      </p>

      <div className="fields-grid">
        <label>
          Start
          <input
            inputMode="text"
            placeholder="0:30"
            value={startInput}
            onChange={(event) => onStartChange(event.target.value)}
            disabled={disabled}
          />
        </label>
        <label>
          End
          <input
            inputMode="text"
            placeholder="1:10"
            value={endInput}
            onChange={(event) => onEndChange(event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="quick-actions">
        <button type="button" className="secondary" onClick={onSetStartNow} disabled={disabled}>
          Use current as start
        </button>
        <button type="button" className="secondary" onClick={onSetEndNow} disabled={disabled}>
          Use current as end
        </button>
      </div>

      {showValidationError ? (
        <p className="field-message error">{validation.error}</p>
      ) : (
        <p className="time-summary" aria-live="polite">
          <strong>{formatTime(currentTime)}</strong>/
          {summaryEndTime ? formatTime(summaryEndTime) : '--:--'}
        </p>
      )}

      <input
        className="loop-progress"
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={boundedProgress}
        style={{ '--progress': `${boundedProgress}%` } as CSSProperties}
        onPointerDown={handleLoopPointerDown}
        onPointerMove={handleLoopPointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onChange={(event) => onRangeSeek(Number(event.target.value))}
        disabled={disabled || !activeRange || !validation.ok}
        aria-label="Seek within loop range"
      />

      <div className="control-row">
        <button type="button" className="icon-button" onClick={onPlaybackToggle} disabled={disabled}>
          {playerStatus === 'playing' ? <Pause size={18} /> : <Play size={18} />}
          <span>{playbackLabel}</span>
        </button>
        <button type="button" className="secondary icon-button" onClick={onToggleLoop} disabled={!canLoop}>
          <Play size={18} />
          <span>Restart loop</span>
        </button>
      </div>

      <div className="speed-section" aria-labelledby="speed-title">
        <div className="speed-heading">
          <h3 id="speed-title">Speed</h3>
          <span>{playbackRate}x</span>
        </div>
        <input
          className="speed-slider"
          type="range"
          min="0"
          max={FINE_SPEED_OPTIONS.length - 1}
          step="1"
          value={activeSpeedIndex}
          style={{ '--speed-progress': `${speedProgress}%` } as CSSProperties}
          onPointerDown={handleSpeedPointerDown}
          onPointerMove={handleSpeedPointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onChange={(event) => {
            const nextIndex = Number(event.target.value);
            draggedSpeedIndexRef.current = nextIndex;
            if (isSpeedDraggingRef.current && speedPointerTypeRef.current === 'touch') {
              return;
            }

            onPlaybackRateChange(FINE_SPEED_OPTIONS[nextIndex]);
          }}
          disabled={disabled}
          aria-label="Playback speed"
        />
        <div className="speed-presets" aria-label="Playback speed presets">
          {visibleSpeedPresets.map((rate) => (
            <button
              key={rate}
              type="button"
              className={rate === playbackRate ? 'speed-preset active' : 'speed-preset'}
              onClick={() => onPlaybackRateChange(rate)}
              disabled={disabled}
            >
              {rate}x
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function getPointerPercent(event: PointerEvent<HTMLInputElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const rawPercent = ((event.clientX - rect.left) / rect.width) * 100;

  return Math.min(100, Math.max(0, rawPercent));
}

function getPointerIndex(event: PointerEvent<HTMLInputElement>, optionCount: number): number {
  if (optionCount <= 1) {
    return 0;
  }

  return (getPointerPercent(event) / 100) * (optionCount - 1);
}

function getStableSpeedIndex(rawIndex: number, currentIndex: number): number {
  const roundedIndex = Math.round(rawIndex);
  if (roundedIndex === currentIndex) {
    return currentIndex;
  }

  const movingForward = roundedIndex > currentIndex;
  const switchThreshold = movingForward
    ? currentIndex + 0.5 + SPEED_SWITCH_MARGIN
    : currentIndex - 0.5 - SPEED_SWITCH_MARGIN;
  const canSwitch = movingForward ? rawIndex >= switchThreshold : rawIndex <= switchThreshold;

  return canSwitch ? roundedIndex : currentIndex;
}

function findClosestSpeedIndex(rate: number): number {
  return FINE_SPEED_OPTIONS.reduce((closestIndex, option, index) => {
    const closestDistance = Math.abs(FINE_SPEED_OPTIONS[closestIndex] - rate);
    const nextDistance = Math.abs(option - rate);
    return nextDistance < closestDistance ? index : closestIndex;
  }, 0);
}
