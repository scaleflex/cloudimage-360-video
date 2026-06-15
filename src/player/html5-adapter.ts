import { VideoPlayerAdapter, type VideoPlayerAdapterOptions } from './adapter';
import { addListener } from '../utils/events';

/**
 * Plain `<video>`-element adapter (MP4 / WebM / native HLS on Safari).
 *
 * The element is appended **inside** the player container but visually
 * suppressed — iOS refuses to play a `<video>` that isn't in the DOM,
 * so we keep it there but make it 1×1 px and transparent. Frames are
 * read out via `VideoTexture` and shown on the WebGL sphere.
 */
export class HTML5Adapter extends VideoPlayerAdapter {
  protected readonly video: HTMLVideoElement;
  private cleanups: Array<() => void> = [];
  private mounted = false;

  constructor(opts: VideoPlayerAdapterOptions) {
    super();

    const v = document.createElement('video');
    v.className = 'ci-360-video-source';
    v.setAttribute('playsinline', '');
    // iOS Safari < 10 honours the non-standard form; harmless on others.
    v.setAttribute('webkit-playsinline', '');
    if (opts.crossOrigin !== undefined && opts.crossOrigin !== null) {
      v.crossOrigin = opts.crossOrigin;
    }
    if (opts.poster) v.poster = opts.poster;
    if (opts.loop) v.loop = true;
    // Autoplay implies muted — browsers block sound on autoplay without a gesture.
    if (opts.muted || opts.autoplay) v.muted = true;
    if (opts.autoplay) v.autoplay = true;
    v.preload = 'auto';
    if (opts.src) v.src = opts.src;

    // Hide visually but keep in DOM.
    v.style.position = 'absolute';
    v.style.width = '1px';
    v.style.height = '1px';
    v.style.opacity = '0';
    v.style.pointerEvents = 'none';
    v.style.left = '0';
    v.style.top = '0';

    this.video = v;

    // Re-emit standard media events as adapter events. `error` is special-cased
    // to carry a real `Error` built from the element's `MediaError` — otherwise
    // consumers' `onError` would receive the `<video>` element itself, and the
    // core's `err instanceof Error` check would fall back to a generic message.
    const events = [
      'play', 'pause', 'timeupdate', 'durationchange', 'ended', 'loadedmetadata',
      'waiting', 'playing', 'progress', 'error', 'seeked', 'volumechange', 'ratechange',
    ] as const;
    for (const evt of events) {
      if (evt === 'error') {
        this.cleanups.push(addListener(v, evt, () => this.emit('error', this.mediaError())));
      } else {
        this.cleanups.push(addListener(v, evt, () => this.emit(evt, v)));
      }
    }
  }

  /** Build a descriptive `Error` from the `<video>` element's `MediaError`. */
  private mediaError(): Error {
    const e = this.video.error;
    if (!e) return new Error('Video playback error');
    const names: Record<number, string> = {
      1: 'MEDIA_ERR_ABORTED',
      2: 'MEDIA_ERR_NETWORK',
      3: 'MEDIA_ERR_DECODE',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
    };
    const name = names[e.code] ?? `code ${e.code}`;
    return new Error(`Video playback error (${name})${e.message ? `: ${e.message}` : ''}`);
  }

  mount(container: HTMLElement): void {
    if (this.mounted) return;
    container.appendChild(this.video);
    this.mounted = true;
  }

  async play(): Promise<void> {
    const p = this.video.play();
    if (p && typeof (p as Promise<void>).then === 'function') {
      await p;
    }
  }
  pause(): void { this.video.pause(); }
  seek(time: number): void { this.video.currentTime = time; }

  getCurrentTime(): number { return this.video.currentTime; }
  getDuration(): number { return this.video.duration; }
  isPaused(): boolean { return this.video.paused; }
  getBufferedEnd(): number {
    const b = this.video.buffered;
    return b.length ? b.end(b.length - 1) : 0;
  }

  setVolume(v: number): void { this.video.volume = Math.max(0, Math.min(1, v)); }
  getVolume(): number { return this.video.volume; }
  setMuted(m: boolean): void { this.video.muted = m; }
  isMuted(): boolean { return this.video.muted; }

  setPlaybackRate(rate: number): void { this.video.playbackRate = rate; }
  getPlaybackRate(): number { return this.video.playbackRate; }

  getVideoElement(): HTMLVideoElement { return this.video; }

  destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.removeAllListeners();
    try {
      this.video.pause();
    } catch {
      /* ignore — element may already be detached */
    }
    this.video.removeAttribute('src');
    try {
      this.video.load(); // releases buffered data
    } catch {
      /* ignore */
    }
    this.video.remove();
    this.mounted = false;
  }
}
