import { VideoPlayerAdapter, type VideoPlayerAdapterOptions } from './adapter';
import { HTML5Adapter } from './html5-adapter';
import type { PlayerType } from '../core/types';

export function isHLSUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

export function isDashUrl(url: string): boolean {
  return /\.mpd(\?|$)/i.test(url);
}

/** URL-based source-type detection. `.m3u8` → HLS, `.mpd` → DASH, else HTML5. */
export function detectPlayerType(src: string): Exclude<PlayerType, 'auto'> {
  if (isHLSUrl(src)) return 'hls';
  if (isDashUrl(src)) return 'dash';
  return 'html5';
}

export interface PlayerFactoryOptions extends VideoPlayerAdapterOptions {
  playerType?: PlayerType;
}

export class PlayerFactory {
  /**
   * Create an adapter for the given source.
   *
   * The HLS and DASH adapters are loaded via `import(...)` so neither
   * `hls.js` nor `dashjs` ships in the main bundle for consumers who only
   * play MP4. Each goes into its own lazy chunk.
   */
  static async create(opts: PlayerFactoryOptions): Promise<VideoPlayerAdapter> {
    const type =
      opts.playerType && opts.playerType !== 'auto'
        ? opts.playerType
        : detectPlayerType(opts.src);

    switch (type) {
      case 'hls': {
        const { HLSAdapter } = await import('./hls-adapter');
        return new HLSAdapter(opts);
      }
      case 'dash': {
        const { DashAdapter } = await import('./dash-adapter');
        return new DashAdapter(opts);
      }
      case 'html5':
      default:
        return new HTML5Adapter(opts);
    }
  }
}
