import { describe, it, expect } from 'vitest';
import {
  fromFilerobotFile,
  pickFilerobotVideoUrl,
  pickFilerobotVideoSources,
} from '../src/filerobot';
import type { FilerobotFileLike } from '../src/filerobot';

// Real-shaped Compression URLs (verified live, CORS-enabled) — see the demo's
// multi-quality example. The 480p variant lives in the internal folder with no
// name prefix; the 720p variant sits next to the original with a `jfk_` prefix.
const URL_480 =
  'https://scaleflex.filerobot.com/.internal/videos/compressed/ed2e03cf-b96e-5d58-9c7e-284104e50000/480p_400K_compressed.mp4?func=proxy';
const URL_720 =
  'https://scaleflex.filerobot.com/plugins/cloudimage/player-360/jfk_720p_400K_compressed.mp4?func=proxy';

describe('pickFilerobotVideoUrl', () => {
  it('prefers an HLS playlist over the direct CDN URL', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/video.mp4' },
      info: {
        playlists: [{ playlists: ['https://cdn.example/video.m3u8'] }],
      },
    };
    const r = pickFilerobotVideoUrl(file);
    expect(r.kind).toBe('hls');
    expect(r.src).toBe('https://cdn.example/video.m3u8');
  });

  it('detects an HLS playlist even when the URL carries a query string', () => {
    // Regression: signed/transform playlist URLs end with `.m3u8?token=…`; a
    // plain endsWith('.m3u8') missed them and dropped adaptive streaming.
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/video.mp4' },
      info: { playlists: ['https://cdn.example/master.m3u8?vh=abc&token=xyz'] },
    };
    const r = pickFilerobotVideoUrl(file);
    expect(r.kind).toBe('hls');
    expect(r.src).toBe('https://cdn.example/master.m3u8?vh=abc&token=xyz');
  });

  it('accepts the legacy shape where `playlists[0]` is a bare string', () => {
    const file: FilerobotFileLike = {
      info: { playlists: ['https://cdn.example/legacy.m3u8'] },
    };
    expect(pickFilerobotVideoUrl(file)).toEqual({
      src: 'https://cdn.example/legacy.m3u8',
      kind: 'hls',
    });
  });

  it('falls back to CDN URL when no playlist is present', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/raw.mp4' },
    };
    const r = pickFilerobotVideoUrl(file);
    expect(r.kind).toBe('mp4');
    expect(r.src).toBe('https://cdn.example/raw.mp4');
  });

  it('falls back to permalink when cdn is missing', () => {
    const file: FilerobotFileLike = {
      url: { permalink: 'https://cdn.example/perma.mp4' },
    };
    const r = pickFilerobotVideoUrl(file);
    expect(r.kind).toBe('mp4');
    expect(r.src).toBe('https://cdn.example/perma.mp4');
  });

  it('falls back to CDN URL when playlist entry is not an .m3u8', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/raw.mp4' },
      info: { playlists: [{ playlists: ['https://cdn.example/something.txt'] }] },
    };
    expect(pickFilerobotVideoUrl(file).kind).toBe('mp4');
  });

  it('returns kind=unknown when nothing usable is present', () => {
    expect(pickFilerobotVideoUrl({}).kind).toBe('unknown');
    expect(pickFilerobotVideoUrl({}).src).toBe('');
  });
});

describe('fromFilerobotFile', () => {
  it('returns spreadable config object with HLS src', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/video.mp4' },
      info: {
        playlists: [{ playlists: ['https://cdn.example/video.m3u8'] }],
        poster: 'https://cdn.example/poster.jpg',
      },
    };
    expect(fromFilerobotFile(file)).toEqual({
      src: 'https://cdn.example/video.m3u8',
      poster: 'https://cdn.example/poster.jpg',
    });
  });

  it('omits poster when not provided', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/raw.mp4' },
    };
    const cfg = fromFilerobotFile(file);
    expect(cfg.src).toBe('https://cdn.example/raw.mp4');
    expect('poster' in cfg).toBe(false);
  });

  it('returns empty src for a malformed file (caller may treat as error)', () => {
    expect(fromFilerobotFile({}).src).toBe('');
  });

  it('result is spreadable into a CI360VideoConfig without overriding caller fields', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/raw.mp4' },
    };
    const merged = { ...fromFilerobotFile(file), autoplay: true, muted: true };
    expect(merged.src).toBe('https://cdn.example/raw.mp4');
    expect(merged.autoplay).toBe(true);
    expect(merged.muted).toBe(true);
  });
});

describe('pickFilerobotVideoSources', () => {
  it('maps a compressed[] array to sorted VideoSource entries (highest first)', () => {
    const file: FilerobotFileLike = { info: { compressed: [URL_480, URL_720] } };
    expect(pickFilerobotVideoSources(file)).toEqual([
      { src: URL_720, label: '720p', height: 720 },
      { src: URL_480, label: '480p', height: 480 },
    ]);
  });

  it('accepts a single string (BE returns one variant as a bare string)', () => {
    const file: FilerobotFileLike = { info: { compressed: URL_720 } };
    expect(pickFilerobotVideoSources(file)).toEqual([
      { src: URL_720, label: '720p', height: 720 },
    ]);
  });

  it('parses the resolution whether or not the filename has a name prefix', () => {
    // URL_480 has no prefix (`480p_...`), URL_720 has one (`jfk_720p_...`).
    const sources = pickFilerobotVideoSources({ info: { compressed: [URL_480, URL_720] } });
    expect(sources.map((s) => s.height)).toEqual([720, 480]);
  });

  it('recognises a 4k variant', () => {
    const file: FilerobotFileLike = {
      info: { compressed: 'https://cdn.example/clip_4k_8000K_compressed.mp4' },
    };
    expect(pickFilerobotVideoSources(file)).toEqual([
      { src: 'https://cdn.example/clip_4k_8000K_compressed.mp4', label: '4K', height: 2160 },
    ]);
  });

  it('labels an unparseable filename as "Source" and sinks it to the bottom', () => {
    const file: FilerobotFileLike = {
      info: { compressed: ['https://cdn.example/mystery.mp4', URL_720] },
    };
    expect(pickFilerobotVideoSources(file)).toEqual([
      { src: URL_720, label: '720p', height: 720 },
      { src: 'https://cdn.example/mystery.mp4', label: 'Source' },
    ]);
  });

  it('de-duplicates repeated URLs', () => {
    const file: FilerobotFileLike = { info: { compressed: [URL_720, URL_720, URL_480] } };
    expect(pickFilerobotVideoSources(file).map((s) => s.src)).toEqual([URL_720, URL_480]);
  });

  it('parses a relative URL (no origin) by its filename', () => {
    const file: FilerobotFileLike = { info: { compressed: ['/media/pano_720p_compressed.mp4'] } };
    expect(pickFilerobotVideoSources(file)).toEqual([
      { src: '/media/pano_720p_compressed.mp4', label: '720p', height: 720 },
    ]);
  });

  it('returns [] when there are no compression variants', () => {
    expect(pickFilerobotVideoSources({})).toEqual([]);
    expect(pickFilerobotVideoSources({ info: {} })).toEqual([]);
    expect(pickFilerobotVideoSources({ info: { compressed: [] } })).toEqual([]);
  });
});

describe('fromFilerobotFile — compression variants', () => {
  it('emits `sources` and loads the highest resolution as `src`', () => {
    const file: FilerobotFileLike = {
      url: { cdn: 'https://cdn.example/jfk.webm' },
      info: { compressed: [URL_480, URL_720] },
    };
    const cfg = fromFilerobotFile(file);
    expect(cfg.src).toBe(URL_720); // highest of the two
    expect(cfg.sources).toEqual([
      { src: URL_720, label: '720p', height: 720 },
      { src: URL_480, label: '480p', height: 480 },
    ]);
  });

  it('prefers HLS over compression variants and omits `sources`', () => {
    const file: FilerobotFileLike = {
      info: {
        playlists: [{ playlists: ['https://cdn.example/video.m3u8'] }],
        compressed: [URL_480, URL_720],
      },
    };
    const cfg = fromFilerobotFile(file);
    expect(cfg.src).toBe('https://cdn.example/video.m3u8');
    expect('sources' in cfg).toBe(false);
  });
});
