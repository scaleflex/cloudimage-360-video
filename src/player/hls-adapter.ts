import { HTML5Adapter } from './html5-adapter';
import type { VideoPlayerAdapterOptions } from './adapter';
import type { QualityId, QualityLevel } from '../core/types';

/**
 * HLS adapter — extension point.
 *
 * `hls.js` is declared as an **optional** peerDependency. We import it
 * dynamically inside `initHLS()` so the bundle stays slim when consumers
 * play plain MP4.
 *
 * Source-attach strategy: prefer **hls.js whenever it's supported** (every
 * desktop browser with MSE) because it's the only path that exposes the
 * rendition list, manual quality selection and ABR control to the player.
 * Native HLS (`<video src=.m3u8>`) is the fallback used only when hls.js can't
 * run — chiefly iOS Safari, where `Hls.isSupported()` is false. Preferring
 * native first (as an earlier version did) silently disabled the quality menu
 * on any browser that merely *reports* native HLS support.
 */
export class HLSAdapter extends HTML5Adapter {
  private hls: any = null;
  /** Set by `destroy()`. Guards the async `initHLS` against a destroy that
   *  lands before the dynamic `import('hls.js')` resolves — otherwise we'd
   *  attach a brand-new `Hls` instance to an already-removed `<video>` and
   *  leak it (network + listeners) forever. Common under React StrictMode. */
  private isDestroyed = false;
  /** Resolves after attach (native HLS or `hls.js`). `play()` awaits this. */
  private readonly ready: Promise<void>;

  constructor(opts: VideoPlayerAdapterOptions) {
    // Don't let the parent set src — we attach the source ourselves.
    super({ ...opts, src: '' });
    this.ready = this.initHLS(opts.src);
  }

  private async initHLS(src: string): Promise<void> {
    const video = this.getVideoElement();
    if (this.isDestroyed) return;

    // Attach the source to a native `<video>` element — used only when hls.js
    // isn't supported (real iOS Safari) or fails to load.
    const attachNativeSource = (): void => {
      video.src = src;
    };

    try {
      // Resolve hls.js. Prefer a global `Hls` (the UMD/CDN build externalises
      // hls.js to `window.Hls`; the bundled dynamic `import('hls.js')` can't be
      // resolved by the browser there and would throw). Bundler/npm consumers
      // have no global, so fall back to the dynamic import of the peer dep.
      let Hls: any = (globalThis as any).Hls;
      if (!Hls) {
        // hls.js is an OPTIONAL peerDependency. The type shim in
        // src/vite-env.d.ts is honoured by `tsc --noEmit` but vite-plugin-dts
        // restricts its file scope and re-reports the missing module — silence it.
        // @ts-ignore -- optional peer dependency, type shim in src/vite-env.d.ts
        const mod = await import('hls.js');
        Hls = (mod as any).default ?? mod;
      }
      // Destroyed while the import was in flight — bail before creating an
      // instance that nothing would ever tear down.
      if (this.isDestroyed) return;

      // Prefer hls.js whenever it's supported (every desktop browser with MSE).
      // It's the ONLY path that exposes the rendition list, manual quality
      // selection and ABR control to us. Native HLS (`<video src=.m3u8>`) plays
      // fine but hides its levels, so the quality menu would be empty/stuck.
      //
      // Crucially this must come BEFORE the `canPlayType` native check:
      // browsers like Safari (and some Chromium builds) report native HLS
      // support, and preferring native there silently disables our quality UI.
      // Native is the fallback only when hls.js can't run — e.g. iOS Safari,
      // where `Hls.isSupported()` is false.
      if (typeof Hls.isSupported === 'function' && Hls.isSupported()) {
        this.hls = new Hls();

        // Wire level events BEFORE loadSource/attachMedia. A cached manifest
        // (HTTP 206/304 from disk) parses almost immediately and hls.js fires
        // `hlsManifestParsed` once — subscribing after loadSource can miss it.
        // Event names are the runtime values of `Hls.Events`; string literals
        // avoid a hard dependency on its types.
        this.hls.on?.('hlsManifestParsed', () => {
          this.emit('qualitylevelsupdated', this.getAvailableQualities());
        });
        this.hls.on?.('hlsLevelSwitched', () => {
          this.emit('qualitychange', this.getCurrentQuality());
        });

        this.hls.loadSource(src);
        this.hls.attachMedia(video);

        // Belt-and-suspenders for the same race: if levels are already known,
        // surface them immediately.
        if (this.getAvailableQualities().length > 0) {
          this.emit('qualitylevelsupdated', this.getAvailableQualities());
        }
        return;
      }

      // hls.js unsupported → native HLS fallback (iOS Safari et al.).
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        attachNativeSource();
        return;
      }
      this.emit('error', new Error('HLS not supported in this environment'));
    } catch (err) {
      // hls.js failed to load (e.g. peer dep missing). Native HLS as last resort.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        attachNativeSource();
        return;
      }
      this.emit(
        'error',
        new Error(
          `CI360Video: failed to load hls.js. Install it as a peer dependency (\`npm i hls.js\`). Original: ${(err as Error)?.message ?? err}`,
        ),
      );
    }
  }

  async play(): Promise<void> {
    await this.ready;
    return super.play();
  }

  override getAvailableQualities(): QualityLevel[] {
    const levels: any[] = this.hls?.levels ?? [];
    return levels.map((l, i) => ({
      id: i,
      label: l.height ? `${l.height}p` : `Level ${i}`,
      width: l.width,
      height: l.height,
      bitrate: l.bitrate,
    }));
  }
  override getCurrentQuality(): QualityId {
    if (!this.hls) return 'auto';
    // `manualLevel` is -1 in ABR/auto mode. Don't use `currentLevel`: its getter
    // returns the level currently *playing* (a real index ≥0) even during ABR,
    // which would wrongly flip the toolbar off "Auto".
    const manual: number = this.hls.manualLevel ?? -1;
    // Guard a stale index: a live/variant manifest reload can shrink the level
    // list while `manualLevel` still points past the new end — fall back to auto
    // rather than highlight a non-existent dropdown item.
    const count: number = this.hls.levels?.length ?? 0;
    return manual === -1 || manual >= count ? 'auto' : manual;
  }
  override setQuality(id: QualityId): void {
    if (!this.hls) return;
    if (id === 'auto') {
      this.hls.currentLevel = -1;
      return;
    }
    // Only accept a valid numeric level index. Guards against a stale cosmetic
    // string id (e.g. '480p') silently breaking the switch by assigning a
    // non-numeric value to `currentLevel`.
    const idx = typeof id === 'number' ? id : Number(id);
    const count = this.hls.levels?.length ?? 0;
    if (Number.isInteger(idx) && idx >= 0 && idx < count) {
      this.hls.currentLevel = idx;
    }
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch {
        /* ignore */
      }
      this.hls = null;
    }
    super.destroy();
  }
}
