import type {
  FilerobotFileLike,
  FilerobotPlayerConfig,
  FilerobotVideoSource,
  FilerobotVideoVariant,
} from './types';

export type {
  FilerobotFileLike,
  FilerobotPlayerConfig,
  FilerobotVideoSource,
  FilerobotVideoVariant,
  FilerobotSourceKind,
} from './types';

/**
 * Pick the best playback URL out of a `FilerobotFile`.
 *
 * Order of preference:
 *   1. HLS playlist (`.m3u8`) from `file.info.playlists[0]` — gives real
 *      adaptive bitrate, quality menu populated with actual rendition levels,
 *      seamless switches between them.
 *   2. Original CDN URL (`file.url.cdn` or `permalink`) — used as fallback
 *      while transcoding is still queued / disabled in the project's settings.
 *
 * Returns the chosen URL plus a `kind` flag so callers can branch (e.g. set
 * up MSE differently for HLS) without re-parsing the URL.
 */
export function pickFilerobotVideoUrl(file: FilerobotFileLike): FilerobotVideoSource {
  const first = file.info?.playlists?.[0];
  const playlistSrc =
    typeof first === 'string'
      ? first
      : (first?.playlists?.[0] ?? '');

  if (playlistSrc.endsWith('.m3u8')) {
    return { src: playlistSrc, kind: 'hls' };
  }
  const cdn = file.url?.cdn ?? file.url?.permalink ?? '';
  if (cdn) return { src: cdn, kind: 'mp4' };

  return { src: '', kind: 'unknown' };
}

/**
 * Pull the resolution out of a Filerobot Compression filename.
 *
 * The transcoder names variants `<name>_<height>p_<bitrate>K_compressed.mp4`
 * (e.g. `jfk_720p_400K_compressed.mp4`) or, in the internal folder, just
 * `<height>p_<bitrate>K_compressed.mp4`. We mirror HUB's own parser
 * (`get-processed-resolution-from-url.ts`, regex `/(?:^|_)(\d+)p[_.]/`) so the
 * two stay in lock-step, plus a `4k` special case the HUB regex misses.
 *
 * Query strings are stripped first so `?func=proxy` never confuses the match.
 * Returns `null` when no resolution token is present.
 */
function parseResolutionFromUrl(url: string): { height: number; label: string } | null {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    /* relative URL (no origin) — fall back to matching the raw string */
    pathname = url.split('?')[0];
  }
  const filename = pathname.split('/').pop() ?? '';

  const np = filename.match(/(?:^|_)(\d+)p[_.]/);
  if (np) {
    const height = Number(np[1]);
    return { height, label: `${height}p` };
  }
  if (/(?:^|_)4k[_.]/i.test(filename)) {
    return { height: 2160, label: '4K' };
  }
  return null;
}

/**
 * Build the player's `sources` list from a file's **Compression** variants
 * (`info.compressed`) — Filerobot's "one separate file per resolution" output.
 *
 * Each entry becomes a `VideoSource`-shaped object: `src` plus a `label` /
 * `height` parsed from the filename. Results are de-duplicated by URL and
 * sorted highest-resolution-first (the conventional quality-menu order).
 * Returns `[]` when the file has no compression variants.
 *
 * Spread the result into `config.sources`, or just use `fromFilerobotFile`,
 * which wires it up automatically.
 */
export function pickFilerobotVideoSources(file: FilerobotFileLike): FilerobotVideoVariant[] {
  const raw = file.info?.compressed;
  const urls = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];

  const seen = new Set<string>();
  const variants: FilerobotVideoVariant[] = [];
  for (const src of urls) {
    if (typeof src !== 'string' || !src || seen.has(src)) continue;
    seen.add(src);
    const res = parseResolutionFromUrl(src);
    variants.push(res ? { src, label: res.label, height: res.height } : { src, label: 'Source' });
  }

  // Highest quality first. Entries without a parsed height sink to the bottom.
  variants.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  return variants;
}

/**
 * Convert a `FilerobotFile` into a subset of `CI360VideoConfig` suitable
 * for spreading into the player constructor:
 *
 *   ```ts
 *   new CI360Video('#player', {
 *     ...fromFilerobotFile(file),
 *     autoplay: true,
 *     muted: true,
 *   });
 *   ```
 *
 * Resolution strategy:
 *   1. **HLS playlist present** → use it (adaptive bitrate already gives
 *      in-stream quality switching; no `sources` needed).
 *   2. **No HLS but Compression variants present** → emit `sources` (separate
 *      file per resolution) and load the highest as `src`.
 *   3. **Neither** → the original CDN URL.
 *
 * The returned object contains only fields derived from the file (`src`,
 * optional `poster`, optional `sources`) — callers keep full control of
 * everything else.
 */
export function fromFilerobotFile(file: FilerobotFileLike): FilerobotPlayerConfig {
  const picked = pickFilerobotVideoUrl(file);
  const cfg: FilerobotPlayerConfig = { src: picked.src };
  if (file.info?.poster) cfg.poster = file.info.poster;

  // Only fall through to per-resolution files when there's no adaptive stream.
  if (picked.kind !== 'hls') {
    const sources = pickFilerobotVideoSources(file);
    if (sources.length > 0) {
      cfg.sources = sources;
      cfg.src = (sources.find((s) => s.default) ?? sources[0]).src;
    }
  }
  return cfg;
}
