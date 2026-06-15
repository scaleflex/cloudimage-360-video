import type { StereoLayout } from '../core/types';

/**
 * Spherical Video V2 metadata detection.
 *
 * Google's Spherical Video metadata embeds the stereo layout directly in the
 * MP4. We support both versions in the wild:
 *
 *  - **V2** (YouTube, Android `spatialmedia`): an `st3d` box inside the visual
 *    sample entry under `moov > trak > mdia > minf > stbl > stsd`. One byte
 *    (`stereo_mode`) gives the layout.
 *  - **V1** (older "Spherical Metadata Tool" files, e.g. ExoPlayer's `congo.mp4`):
 *    an RDF/XML blob in a `uuid` box, with a
 *    `<GSpherical:StereoMode>top-bottom</…>` element.
 *
 * This lets us answer "is this source stereo, and how is it laid out?"
 * **deterministically** instead of guessing from the frame aspect ratio (which
 * is ambiguous once 180° content is in play — mono-180° and top-bottom-360°
 * are both 1:1). The browser doesn't expose this metadata, so we read it
 * ourselves with HTTP range requests over just the `moov` box (no media data).
 *
 * Scope: MP4 / ISO-BMFF progressive sources only. HLS/DASH and non-ISO
 * containers (WebM) return `null` → the caller keeps its configured/default
 * layout. Every failure path (no range support, network error, box absent,
 * malformed) returns `null` and never throws — detection is best-effort.
 */

/** `st3d` `stereo_mode` byte values, per the Spherical Video V2 spec. */
const STEREO_MODE: Record<number, StereoLayout> = {
  0: 'mono',
  1: 'top-bottom',
  2: 'side-by-side',
  // 3 = "stereo-custom" (per-sample) — we can't honour it statically, so it is
  // intentionally absent and falls through to `null` (treated as mono).
};

// FourCC bytes for 'st3d' (0x73 0x74 0x33 0x64).
const ST3D = [0x73, 0x74, 0x33, 0x64];
// A real `st3d` is a fixed-size full box: size(4)=13 + type(4) + version(1) +
// flags(3) + stereo_mode(1). Validating the size + version around a fourcc
// match makes a coincidental byte sequence essentially impossible.
const ST3D_BOX_SIZE = 13;

function readU32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] * 0x1000000) +
    (buf[offset + 1] << 16) +
    (buf[offset + 2] << 8) +
    buf[offset + 3]
  );
}

// Spherical V1 `<GSpherical:StereoMode>` values → our layout. V1 uses "none"
// for monoscopic (not "mono"), and "left-right" for side-by-side.
const SV1_STEREO: Record<string, StereoLayout> = {
  none: 'mono',
  mono: 'mono',
  'top-bottom': 'top-bottom',
  'left-right': 'side-by-side',
};
// The value text immediately follows the opening tag, which ends with this.
const SV1_TAG = ':StereoMode>';

/** Index of the first occurrence of an ASCII needle in `buf`, or -1. */
function indexOfAscii(buf: Uint8Array, needle: string, from = 0): number {
  outer: for (let i = from; i + needle.length <= buf.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

/** Spherical V2: a validated `st3d` box anywhere in `moov`. */
function parseV2(moov: Uint8Array): StereoLayout | null {
  // Need room for size(4)+type(4)+version(1)+flags(3)+mode(1) = 13 bytes from
  // the start of the box, and the box starts 4 bytes before the fourcc.
  for (let i = 4; i + 9 <= moov.length; i++) {
    if (
      moov[i] !== ST3D[0] ||
      moov[i + 1] !== ST3D[1] ||
      moov[i + 2] !== ST3D[2] ||
      moov[i + 3] !== ST3D[3]
    ) {
      continue;
    }
    // Validate the enclosing box header: declared size == 13 and version == 0.
    if (readU32(moov, i - 4) !== ST3D_BOX_SIZE) continue;
    if (moov[i + 4] !== 0) continue; // version
    const mode = moov[i + 8]; // after version(1) + flags(3)
    return STEREO_MODE[mode] ?? null;
  }
  return null;
}

/** Spherical V1: `<GSpherical:StereoMode>…</…>` in the RDF/XML `uuid` blob. */
function parseV1(moov: Uint8Array): StereoLayout | null {
  const tag = indexOfAscii(moov, SV1_TAG);
  if (tag < 0) return null;
  const start = tag + SV1_TAG.length;
  const end = indexOfAscii(moov, '<', start); // value runs up to the closing tag
  if (end < 0) return null;
  // Cap the read so a missing closing '<' can't scan the whole buffer. 64 is
  // ample for the longest valid value ("left-right") plus any padding.
  let value = '';
  for (let i = start; i < end && i < start + 64; i++) value += String.fromCharCode(moov[i]);
  return SV1_STEREO[value.trim().toLowerCase()] ?? null;
}

/**
 * Scan an in-memory `moov` buffer for Spherical Video stereo metadata (V2
 * `st3d` first, then the V1 XML fallback) and return the layout it declares.
 * Pure (no I/O) so it can be unit-tested with hand-built buffers. Returns
 * `null` when neither form is present.
 *
 * We scan rather than walking the full box tree because the visual sample
 * entry that holds `st3d` is codec-specific (`avc1`/`hvc1`/`av01`/…) and the V1
 * blob lives in a `uuid` box; a validated, length-checked scan over the
 * (media-data-free) `moov` is both simpler and robust.
 */
export function parseStereoModeFromMoov(moov: Uint8Array): StereoLayout | null {
  return parseV2(moov) ?? parseV1(moov);
}

/** True for URLs we should not probe — streaming manifests carry no `moov`. */
function isStreamingManifest(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.m3u8') || clean.endsWith('.mpd');
}

interface Chunk {
  bytes: Uint8Array;
  /** Total file size from `Content-Range`, or `null` if unknown. */
  total: number | null;
}

/**
 * Range-fetch `[start, start+length)`. Requires a `206 Partial Content`
 * response — if the server ignores the `Range` header and returns the whole
 * body (`200`), we bail rather than risk downloading a multi-MB video to read
 * a handful of header bytes.
 */
async function readChunk(
  url: string,
  start: number,
  length: number,
  signal?: AbortSignal,
): Promise<Chunk | null> {
  const end = start + length - 1;
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    signal,
  });
  if (res.status !== 206) return null;
  const total = parseContentRangeTotal(res.headers.get('Content-Range'));
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, total };
}

function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  // Format: "bytes <start>-<end>/<total>"  (total may be "*").
  const slash = header.lastIndexOf('/');
  if (slash < 0) return null;
  const total = Number(header.slice(slash + 1).trim());
  return Number.isFinite(total) ? total : null;
}

// Header read size: 8 bytes for the standard box header, +8 for a possible
// 64-bit `largesize`. 16 bytes covers both.
const BOX_HEADER_BYTES = 16;
// Don't follow more than this many top-level boxes looking for `moov`, and
// don't pull a `moov` larger than this into memory — backstops against
// pathological or hostile inputs.
const MAX_TOP_LEVEL_BOXES = 32;
// Cap on how much of `moov` we pull into memory. `st3d` lives in `stsd` (early
// in `stbl`) and the V1 `uuid` blob sits near the top of `moov`, both ahead of
// the large `stco`/`stsz`/`stts` sample tables — so a generous-but-bounded cap
// captures the stereo metadata while still refusing a pathological `moov`. On
// the rare overflow we fall back to `'mono'` (best-effort, never throws).
const MAX_MOOV_BYTES = 32 * 1024 * 1024;

/**
 * Locate the `moov` box by walking top-level box headers via range requests
 * (skipping over `mdat`/`ftyp`/`free` without downloading their bodies), then
 * fetch and parse just that box. Returns the detected stereo layout, or `null`.
 */
export async function detectStereoLayout(
  url: string,
  signal?: AbortSignal,
): Promise<StereoLayout | null> {
  if (!url || isStreamingManifest(url)) return null;

  try {
    let offset = 0;
    let fileSize: number | null = null;

    for (let i = 0; i < MAX_TOP_LEVEL_BOXES; i++) {
      if (fileSize !== null && offset >= fileSize) break;

      const header = await readChunk(url, offset, BOX_HEADER_BYTES, signal);
      if (!header || header.bytes.length < 8) return null;
      if (fileSize === null) fileSize = header.total;

      let size = readU32(header.bytes, 0);
      const type = String.fromCharCode(
        header.bytes[4],
        header.bytes[5],
        header.bytes[6],
        header.bytes[7],
      );

      // size === 1 → real size is a 64-bit `largesize` in the next 8 bytes.
      if (size === 1) {
        if (header.bytes.length < 16) return null;
        const hi = readU32(header.bytes, 8);
        const lo = readU32(header.bytes, 12);
        size = hi * 0x100000000 + lo;
      } else if (size === 0) {
        // "to end of file" — only valid for the last box; we can't skip past it.
        return null;
      }
      if (size < 8) return null; // malformed

      if (type === 'moov') {
        const moovLen = Math.min(size, MAX_MOOV_BYTES);
        const moov = await readChunk(url, offset, moovLen, signal);
        if (!moov) return null;
        return parseStereoModeFromMoov(moov.bytes);
      }

      offset += size;
    }
    return null;
  } catch {
    // Aborted, network failure, CORS — all best-effort, all → null.
    return null;
  }
}
