const YOUTUBE_API_SRC = 'https://www.youtube.com/iframe_api';

let apiPromise: Promise<void> | null = null;

export function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YOUTUBE_API_SRC}"]`,
    );

    window.onYouTubeIframeAPIReady = () => resolve();

    if (existingScript) {
      existingScript.addEventListener('error', () => {
        apiPromise = null;
        reject(new Error('Unable to load the YouTube player.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = YOUTUBE_API_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('Unable to load the YouTube player.'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}
