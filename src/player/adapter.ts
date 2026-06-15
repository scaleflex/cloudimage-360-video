import { EventEmitter } from '../utils/events';
import type { QualityId, QualityLevel } from '../core/types';

export interface VideoPlayerAdapterOptions {
  src: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  poster?: string;
  /** `<video crossorigin>` attribute. Pass `'anonymous'` to keep WebGL textures untainted. */
  crossOrigin?: string | null;
}

/**
 * Abstract video source. Mirrors the adapter layer in `@cloudimage/video-hotspot`
 * so source detection (MP4 vs HLS vs future formats) doesn't leak into the
 * rendering or UI code.
 *
 * Why an abstraction over a plain `<video>` tag: switching to HLS, DASH, or
 * a third-party iframe (YouTube/Vimeo) is a one-file drop-in. Without this,
 * source assumptions bleed into the player class and every refactor turns
 * into a rewrite.
 *
 * Emits (mirrored from `HTMLMediaElement` events):
 *   `play`, `pause`, `timeupdate`, `durationchange`, `ended`, `loadedmetadata`,
 *   `waiting`, `playing`, `progress`, `seeked`, `volumechange`, `ratechange`,
 *   `error`.
 */
export abstract class VideoPlayerAdapter extends EventEmitter {
  /** Attach internal media elements (e.g. `<video>`) to a host container.
   *  In the 360 player the video is appended hidden — the user sees the
   *  WebGL sphere; the element is just a frame source. */
  abstract mount(container: HTMLElement): void;

  abstract play(): Promise<void>;
  abstract pause(): void;
  abstract seek(time: number): void;

  abstract getCurrentTime(): number;
  abstract getDuration(): number;
  abstract isPaused(): boolean;
  abstract getBufferedEnd(): number;

  abstract setVolume(volume: number): void;
  abstract getVolume(): number;
  abstract setMuted(muted: boolean): void;
  abstract isMuted(): boolean;

  abstract setPlaybackRate(rate: number): void;
  abstract getPlaybackRate(): number;

  /** Underlying `<video>` element. Required — it's the frame source for the
   *  `VideoTexture`. Future iframe-based adapters (YouTube/Vimeo) don't fit
   *  the 360 player and are out of scope for this adapter family. */
  abstract getVideoElement(): HTMLVideoElement;

  // ---- Quality / rendition selection ----
  //
  // Streaming adapters (HLS, DASH) expose level info; HTML5 has none, so the
  // base provides default no-op implementations. Toolbar hides the quality
  // dropdown when `getAvailableQualities()` returns an empty array.
  //
  // Emits:
  //   `qualitylevelsupdated` (args: QualityLevel[]) — when levels first become
  //       known or change (e.g. HLS manifest reload).
  //   `qualitychange`        (args: QualityId)       — when the active level
  //       changes (manual selection or ABR switch).

  getAvailableQualities(): QualityLevel[] {
    return [];
  }
  getCurrentQuality(): QualityId {
    return 'auto';
  }
  setQuality(_id: QualityId): void {
    void _id;
    // No-op for sources without level concept. Streaming adapters override.
  }

  abstract destroy(): void;
}
