import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseStereoModeFromMoov,
  detectStereoLayout,
} from '../src/player/spherical-metadata';

// ---- ISO-BMFF box builders ---------------------------------------------------

function box(type: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.length;
  const b = new Uint8Array(size);
  new DataView(b.buffer).setUint32(0, size);
  for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i);
  b.set(payload, 8);
  return b;
}

/** A spec-shaped `st3d` full box: version(1) + flags(3) + stereo_mode(1). */
function st3d(mode: number): Uint8Array {
  return box('st3d', new Uint8Array([0, 0, 0, 0, mode]));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

describe('parseStereoModeFromMoov', () => {
  it('reads stereo_mode 0 → mono', () => {
    expect(parseStereoModeFromMoov(st3d(0))).toBe('mono');
  });

  it('reads stereo_mode 1 → top-bottom', () => {
    expect(parseStereoModeFromMoov(st3d(1))).toBe('top-bottom');
  });

  it('reads stereo_mode 2 → side-by-side', () => {
    expect(parseStereoModeFromMoov(st3d(2))).toBe('side-by-side');
  });

  it('finds st3d when nested among other boxes', () => {
    const moov = concat(box('mvhd', new Uint8Array(20)), st3d(1), box('udta', new Uint8Array(4)));
    expect(parseStereoModeFromMoov(moov)).toBe('top-bottom');
  });

  it('returns null when no st3d is present', () => {
    const moov = concat(box('mvhd', new Uint8Array(20)), box('trak', new Uint8Array(8)));
    expect(parseStereoModeFromMoov(moov)).toBeNull();
  });

  it('returns null for stereo_mode 3 (stereo-custom, unsupported)', () => {
    expect(parseStereoModeFromMoov(st3d(3))).toBeNull();
  });

  // ---- Spherical V1 (GSpherical XML) — the format congo.mp4 actually uses ----

  function sphericalXml(stereoMode: string): Uint8Array {
    const xml =
      '<?xml version="1.0"?><rdf:SphericalVideo ' +
      'xmlns:GSpherical="http://ns.google.com/videos/1.0/spherical/">' +
      '<GSpherical:Spherical>true</GSpherical:Spherical>' +
      '<GSpherical:ProjectionType>equirectangular</GSpherical:ProjectionType>' +
      `<GSpherical:StereoMode>${stereoMode}</GSpherical:StereoMode>` +
      '</rdf:SphericalVideo>';
    const payload = new Uint8Array(xml.length);
    for (let i = 0; i < xml.length; i++) payload[i] = xml.charCodeAt(i);
    return box('uuid', payload);
  }

  it('V1: <GSpherical:StereoMode>top-bottom → top-bottom', () => {
    expect(parseStereoModeFromMoov(sphericalXml('top-bottom'))).toBe('top-bottom');
  });

  it('V1: left-right → side-by-side', () => {
    expect(parseStereoModeFromMoov(sphericalXml('left-right'))).toBe('side-by-side');
  });

  it('V1: none → mono', () => {
    expect(parseStereoModeFromMoov(sphericalXml('none'))).toBe('mono');
  });

  it('prefers V2 st3d over V1 XML when both are present', () => {
    const moov = concat(st3d(2), sphericalXml('top-bottom'));
    expect(parseStereoModeFromMoov(moov)).toBe('side-by-side');
  });

  it('ignores a coincidental "st3d" fourcc with a wrong box size', () => {
    // The four chars appear, but the preceding 4-byte size is not 13 → rejected.
    const bogus = concat(
      new Uint8Array([0, 0, 0, 99]), // size = 99, not 13
      new Uint8Array([0x73, 0x74, 0x33, 0x64]), // "st3d"
      new Uint8Array([0, 0, 0, 0, 1]),
    );
    expect(parseStereoModeFromMoov(bogus)).toBeNull();
  });
});

// ---- network detection (mocked fetch) ---------------------------------------

/** Mock `fetch` that serves byte ranges out of a synthetic file with 206. */
function mockRangeFetch(file: Uint8Array) {
  return vi.fn(async (_url: string, opts: { headers: Record<string, string> }) => {
    const m = /bytes=(\d+)-(\d+)/.exec(opts.headers.Range)!;
    const start = Number(m[1]);
    const end = Number(m[2]);
    const slice = file.slice(start, Math.min(end + 1, file.length));
    return {
      status: 206,
      headers: {
        get: (k: string) =>
          k.toLowerCase() === 'content-range' ? `bytes ${start}-${end}/${file.length}` : null,
      },
      arrayBuffer: async () => slice.buffer,
    } as unknown as Response;
  });
}

describe('detectStereoLayout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks past ftyp to moov and reads the layout', async () => {
    const file = concat(box('ftyp', new Uint8Array(8)), box('moov', st3d(1)));
    const fetchMock = mockRangeFetch(file);
    vi.stubGlobal('fetch', fetchMock);

    await expect(detectStereoLayout('https://cdn.example/congo.mp4')).resolves.toBe('top-bottom');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('returns null when moov has no st3d', async () => {
    const file = concat(box('ftyp', new Uint8Array(8)), box('moov', box('mvhd', new Uint8Array(20))));
    vi.stubGlobal('fetch', mockRangeFetch(file));
    await expect(detectStereoLayout('https://cdn.example/plain.mp4')).resolves.toBeNull();
  });

  it('does not fetch for HLS/DASH manifests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(detectStereoLayout('https://cdn.example/stream.m3u8')).resolves.toBeNull();
    await expect(detectStereoLayout('https://cdn.example/stream.mpd?x=1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when the server ignores Range (status 200)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 200, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }) as unknown as Response),
    );
    await expect(detectStereoLayout('https://cdn.example/norange.mp4')).resolves.toBeNull();
  });

  it('returns null on network error (best-effort, never throws)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(detectStereoLayout('https://cdn.example/down.mp4')).resolves.toBeNull();
  });
});
