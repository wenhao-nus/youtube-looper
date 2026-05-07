export type PlayerStateChangeEvent = {
  data: number;
  target: YouTubePlayer;
};

export type PlaybackRateChangeEvent = {
  data: number;
  target: YouTubePlayer;
};

export type PlayerReadyEvent = {
  target: YouTubePlayer;
};

export type YouTubePlayer = {
  destroy: () => void;
  getAvailablePlaybackRates: () => number[];
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getPlaybackRate: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (suggestedRate: number) => void;
};

export type YouTubeConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: PlayerReadyEvent) => void;
      onStateChange?: (event: PlayerStateChangeEvent) => void;
      onPlaybackRateChange?: (event: PlaybackRateChangeEvent) => void;
      onError?: () => void;
    };
  },
) => YouTubePlayer;

declare global {
  interface Window {
    YT?: {
      Player: YouTubeConstructor;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
