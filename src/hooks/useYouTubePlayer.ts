import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadYouTubeIframeApi } from '../lib/youtubeApi';
import type { LoopRange } from '../utils/validation';
import type {
  PlaybackRateChangeEvent,
  PlayerStateChangeEvent,
  YouTubePlayer,
} from '../types/youtube';

type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

type UseYouTubePlayerOptions = {
  videoId: string | null;
  loopRange: LoopRange | null;
  isLooping: boolean;
};

export function useYouTubePlayer({
  videoId,
  loopRange,
  isLooping,
}: UseYouTubePlayerOptions) {
  const containerId = useMemo(() => 'youtube-player-root', []);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const rangeRef = useRef(loopRange);
  const loopingRef = useRef(isLooping);
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [duration, setDuration] = useState<number | undefined>();
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [availablePlaybackRates, setAvailablePlaybackRates] = useState<number[]>([1]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rangeRef.current = loopRange;
    loopingRef.current = isLooping;
  }, [loopRange, isLooping]);

  useEffect(() => {
    if (!videoId) {
      setStatus('idle');
      setDuration(undefined);
      setCurrentTime(0);
      setPlaybackRateState(1);
      setAvailablePlaybackRates([1]);
      setError(null);
      return;
    }

    let disposed = false;
    setStatus('loading');
    setError(null);
    setDuration(undefined);
    setCurrentTime(0);
    setPlaybackRateState(1);
    setAvailablePlaybackRates([1]);

    let createdPlayer: YouTubePlayer | null = null;

    loadYouTubeIframeApi()
      .then(() => {
        if (disposed || !window.YT?.Player) {
          return;
        }

        playerRef.current?.destroy();
        createdPlayer = new window.YT.Player(containerId, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (disposed) {
                return;
              }

              const loadedDuration = event.target.getDuration();
              const loadedRates = event.target
                .getAvailablePlaybackRates()
                .filter((rate) => rate >= 0.25 && rate <= 2);
              setDuration(loadedDuration || undefined);
              setAvailablePlaybackRates(loadedRates.length ? loadedRates : [1]);
              setPlaybackRateState(event.target.getPlaybackRate());
              setStatus('ready');
            },
            onStateChange: (event: PlayerStateChangeEvent) => {
              if (!window.YT) {
                return;
              }

              if (event.data === window.YT.PlayerState.PLAYING) {
                setStatus('playing');
              }

              if (event.data === window.YT.PlayerState.PAUSED) {
                setStatus('paused');
              }

              if (event.data === window.YT.PlayerState.ENDED && loopingRef.current) {
                const range = rangeRef.current;
                event.target.seekTo(range?.start ?? 0, true);
                event.target.playVideo();
              }
            },
            onPlaybackRateChange: (event: PlaybackRateChangeEvent) => {
              setPlaybackRateState(event.data);
            },
            onError: () => {
              setStatus('error');
              setError('The video could not be loaded. Check the URL or video permissions.');
            },
          },
        });
        playerRef.current = createdPlayer;
      })
      .catch(() => {
        if (!disposed) {
          setStatus('error');
          setError('The YouTube player failed to load. Check your connection and try again.');
        }
      });

    return () => {
      disposed = true;
      if (createdPlayer && playerRef.current === createdPlayer) {
        createdPlayer.destroy();
        playerRef.current = null;
      }
    };
  }, [containerId, videoId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      const nextTime = player.getCurrentTime();
      setCurrentTime(nextTime);

      const nextDuration = player.getDuration();
      if (nextDuration) {
        setDuration(nextDuration);
      }

      setPlaybackRateState(player.getPlaybackRate());

      const range = rangeRef.current;
      if (!loopingRef.current || !range) {
        return;
      }

      const wasPlaying = player.getPlayerState() === window.YT?.PlayerState.PLAYING;

      if (nextTime < range.start - 0.08) {
        player.seekTo(range.start, true);
        if (wasPlaying) {
          player.playVideo();
        }
        setCurrentTime(range.start);
        return;
      }

      if (nextTime >= range.end - 0.08) {
        player.seekTo(range.start, true);
        if (wasPlaying) {
          player.playVideo();
        }
        setCurrentTime(range.start);
      }
    }, 90);

    return () => window.clearInterval(timer);
  }, []);

  const playLoop = useCallback((rangeOverride?: LoopRange) => {
    const player = playerRef.current;
    const range = rangeOverride ?? rangeRef.current;

    if (!player || !range) {
      return;
    }

    rangeRef.current = range;
    player.seekTo(range.start, true);
    player.playVideo();
    setStatus('playing');
  }, []);

  const pause = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    player.pauseVideo();
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    player.playVideo();
    setStatus('playing');
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    player.setPlaybackRate(rate);
    window.setTimeout(() => {
      setPlaybackRateState(player.getPlaybackRate());
    }, 0);
  }, []);

  return {
    containerId,
    status,
    error,
    duration,
    currentTime,
    playbackRate,
    availablePlaybackRates,
    playLoop,
    pause,
    resume,
    seekTo,
    setPlaybackRate,
  };
}
