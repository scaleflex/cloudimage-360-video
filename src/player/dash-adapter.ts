import { HTML5Adapter } from './html5-adapter';
import type { VideoPlayerAdapterOptions } from './adapter';
import type { QualityId, QualityLevel } from '../core/types';

/**
 * MPEG-DASH adapter — extension point.
 *
 * `dashjs` is declared as an **optional** peerDependency. We import it
 * dynamically inside `initDash()` so the bundle stays slim when consumers
 * play plain MP4 or HLS.
 *
 * Mirrors the structure of `HLSAdapter` so the two streaming paths stay
 * easy to reason about side-by-side.
 */
export class DashAdapter extends HTML5Adapter {
  private dashPlayer: any = null;
  /** Set by `destroy()`. Guards `initDash` against a destroy that lands before
   *  the dynamic `import('dashjs')` resolves — otherwise we'd spin up a
   *  MediaPlayer attached to an already-removed `<video>` and leak it. */
  private isDestroyed = false;
  /** Resolves after `dashjs` is loaded and attached. `play()` awaits this. */
  private readonly ready: Promise<void>;
  /** The user's pinned level index, or `null` for ABR/auto. Tracked here (like
   *  the HLS adapter's `manualLevel`) instead of reading it back from dash.js
   *  settings, which lag right after a pick and momentarily report `'auto'`. */
  private manualQuality: number | null = null;

  constructor(opts: VideoPlayerAdapterOptions) {
    // Don't let the parent set src — dash.js attaches the source itself.
    super({ ...opts, src: '' });
    this.ready = this.initDash(opts.src, opts.autoplay ?? false);
  }

  private async initDash(src: string, autoplay: boolean): Promise<void> {
    const video = this.getVideoElement();

    try {
      // Prefer a global `dashjs` (the UMD/CDN build externalises it to
      // `window.dashjs`; the bundled dynamic `import('dashjs')` can't be resolved
      // by the browser there). Bundler/npm consumers fall back to the peer dep.
      let dashjs: any = (globalThis as any).dashjs;
      if (!dashjs) {
        // @ts-ignore -- optional peer dependency, type shim in src/vite-env.d.ts
        const mod = await import('dashjs');
        dashjs = (mod as any).default ?? mod;
      }
      // Destroyed while the import was in flight — bail before attaching.
      if (this.isDestroyed) return;
      this.dashPlayer = dashjs.MediaPlayer().create();

      // Wire quality events BEFORE initialize() for the same reason as the HLS
      // adapter: a fast/cached manifest can fire `streamInitialized` before a
      // later-registered listener, dropping the level list. dash.js exposes the
      // event names as `MediaPlayerEvents`; string literals keep us decoupled.
      this.dashPlayer.on?.('streamInitialized', () => {
        this.emit('qualitylevelsupdated', this.getAvailableQualities());
      });
      this.dashPlayer.on?.('qualityChangeRendered', () => {
        this.emit('qualitychange', this.getCurrentQuality());
      });

      this.dashPlayer.initialize(video, src, autoplay);
    } catch (err) {
      this.emit(
        'error',
        new Error(
          `CI360Video: failed to load dashjs. Install it as a peer dependency (\`npm i dashjs\`). Original: ${(err as Error)?.message ?? err}`,
        ),
      );
    }
  }

  async play(): Promise<void> {
    await this.ready;
    return super.play();
  }

  override getAvailableQualities(): QualityLevel[] {
    if (!this.dashPlayer || typeof this.dashPlayer.getBitrateInfoListFor !== 'function') {
      return [];
    }
    const levels: any[] = this.dashPlayer.getBitrateInfoListFor('video') ?? [];
    return levels.map((l: any) => ({
      id: l.qualityIndex,
      label: l.height ? `${l.height}p` : `Level ${l.qualityIndex}`,
      width: l.width,
      height: l.height,
      bitrate: l.bitrate,
    }));
  }
  override getCurrentQuality(): QualityId {
    if (!this.dashPlayer) return 'auto';
    return this.manualQuality ?? 'auto';
  }
  override setQuality(id: QualityId): void {
    if (!this.dashPlayer) return;
    try {
      if (id === 'auto') {
        this.manualQuality = null;
        this.dashPlayer.updateSettings?.({
          streaming: { abr: { autoSwitchBitrate: { video: true } } },
        });
      } else if (typeof id === 'number') {
        // Guard against a stray string id reaching dash.js (mirrors the HLS
        // adapter); only numeric level indices map to a concrete rendition.
        this.manualQuality = id;
        this.dashPlayer.updateSettings?.({
          streaming: { abr: { autoSwitchBitrate: { video: false } } },
        });
        this.dashPlayer.setQualityFor?.('video', id);
      }
    } catch {
      /* ignore */
    }
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.dashPlayer) {
      // dash.js 4.x uses `.reset()`; older builds expose `.destroy()`. Try both.
      try {
        if (typeof this.dashPlayer.reset === 'function') {
          this.dashPlayer.reset();
        } else if (typeof this.dashPlayer.destroy === 'function') {
          this.dashPlayer.destroy();
        }
      } catch {
        /* ignore */
      }
      this.dashPlayer = null;
    }
    super.destroy();
  }
}
