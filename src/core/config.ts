import type { CI360VideoConfig } from './types';

/**
 * Defaults are the source of truth — every config option mentioned in the
 * public types is given a concrete default here. Anything missing means it's
 * a required field (currently only `src`).
 */
export const DEFAULT_CONFIG: CI360VideoConfig = {
  src: '',

  projection: 'equirectangular',
  // 'auto' probes Spherical Video V2 (`st3d`) metadata on MP4 sources and
  // resolves to the declared layout; mono content (and non-MP4) stays mono.
  stereo: 'auto',
  lensFovDeg: 180,

  // playback
  autoplay: false,
  loop: false,
  muted: false,
  crossOrigin: 'anonymous',
  playerType: 'auto',

  // initial view + limits (degrees)
  initialLon: 0,
  initialLat: 0,
  fov: 75,
  fovMin: 30,
  fovMax: 100,
  latMin: -85,
  latMax: 85,

  // controls
  controls: true,
  dragToRotate: true,
  invertDrag: false,
  // 1.0 = pixel-perfect drag: cursor and texture move 1:1. Lower = slower / film-like;
  // higher = punchier. Most consumer 360 viewers sit in 0.8–1.5.
  rotateSpeed: 1.0,
  scrollToZoom: true,
  gyroscope: false,
  damping: true,
  dampingFactor: 0.1,
  autoRotate: false,
  // Degrees per second. Positive = clockwise (look right); negative = anti-clockwise.
  // 10 deg/s ≈ a full revolution every 36 seconds — perceptible but not dizzying.
  autoRotateSpeed: 10,

  // UI
  theme: 'dark',
  fullscreenButton: true,
  vrButton: false, // extension point — disabled by default

  // perf
  sphereSegments: 64,
  pixelRatio: 2,
  antialias: true,
  autoLoad: true,

  // a11y
  alt: '360° video',
};

// ---- data-attribute coercion helpers ----

function toBool(v: string): boolean {
  return v === 'true' || v === '1' || v === 'yes' || v === '';
}

function toNumber(v: string): number | undefined {
  if (v.trim() === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

/**
 * `data-ci-360-video-*` ↔ camelCase config key map plus a coercion function.
 * Adding a new config option means adding a line here and a default above.
 */
const DATA_ATTR_MAP: Record<string, { key: keyof CI360VideoConfig; coerce: (v: string) => unknown }> = {
  src:                    { key: 'src',                 coerce: String },
  projection:             { key: 'projection',          coerce: String },
  stereo:                 { key: 'stereo',              coerce: String },
  'lens-fov-deg':         { key: 'lensFovDeg',          coerce: toNumber },

  autoplay:               { key: 'autoplay',            coerce: toBool },
  loop:                   { key: 'loop',                coerce: toBool },
  muted:                  { key: 'muted',               coerce: toBool },
  poster:                 { key: 'poster',              coerce: String },
  'cross-origin':         { key: 'crossOrigin',         coerce: String },
  'player-type':          { key: 'playerType',          coerce: String },

  'initial-lon':          { key: 'initialLon',          coerce: toNumber },
  'initial-lat':          { key: 'initialLat',          coerce: toNumber },
  fov:                    { key: 'fov',                 coerce: toNumber },
  'fov-min':              { key: 'fovMin',              coerce: toNumber },
  'fov-max':              { key: 'fovMax',              coerce: toNumber },
  'lat-min':              { key: 'latMin',              coerce: toNumber },
  'lat-max':              { key: 'latMax',              coerce: toNumber },

  controls:               { key: 'controls',            coerce: toBool },
  'drag-to-rotate':       { key: 'dragToRotate',        coerce: toBool },
  'invert-drag':          { key: 'invertDrag',          coerce: toBool },
  'rotate-speed':         { key: 'rotateSpeed',         coerce: toNumber },
  'scroll-to-zoom':       { key: 'scrollToZoom',        coerce: toBool },
  gyroscope:              { key: 'gyroscope',           coerce: toBool },
  damping:                { key: 'damping',             coerce: toBool },
  'damping-factor':       { key: 'dampingFactor',       coerce: toNumber },
  'auto-rotate':          { key: 'autoRotate',          coerce: toBool },
  'auto-rotate-speed':    { key: 'autoRotateSpeed',     coerce: toNumber },

  theme:                  { key: 'theme',               coerce: String },
  'fullscreen-button':    { key: 'fullscreenButton',    coerce: toBool },
  'vr-button':            { key: 'vrButton',            coerce: toBool },

  'sphere-segments':      { key: 'sphereSegments',      coerce: toNumber },
  'pixel-ratio':          { key: 'pixelRatio',          coerce: toNumber },
  antialias:              { key: 'antialias',           coerce: toBool },
  'auto-load':            { key: 'autoLoad',            coerce: toBool },

  alt:                    { key: 'alt',                 coerce: String },
};

/**
 * Parse `data-ci-360-video-*` attributes off an HTMLElement into a partial
 * config object. Unknown attributes are ignored; malformed values are warned
 * about and skipped rather than thrown — same convention as 3d-view.
 */
export function parseDataAttributes(element: HTMLElement): Partial<CI360VideoConfig> {
  const config: Record<string, unknown> = {};

  for (const [attrSuffix, mapping] of Object.entries(DATA_ATTR_MAP)) {
    const attrName = `data-ci-360-video-${attrSuffix}`;
    const value = element.getAttribute(attrName);
    if (value === null) continue;

    try {
      const coerced = mapping.coerce(value);
      if (coerced !== undefined) {
        config[mapping.key] = coerced;
      }
    } catch (e) {
      console.warn(`CI360Video: failed to parse data attribute "${attrName}":`, e);
    }
  }

  return config as Partial<CI360VideoConfig>;
}

/**
 * Shallow merge: `userConfig` wins over defaults. `undefined` values are
 * skipped so callers can spread partial configs without overwriting defaults
 * with `undefined`.
 */
export function mergeConfig(userConfig: Partial<CI360VideoConfig>): CI360VideoConfig {
  const merged: CI360VideoConfig = { ...DEFAULT_CONFIG };
  for (const [key, value] of Object.entries(userConfig)) {
    if (value !== undefined) {
      (merged as any)[key] = value;
    }
  }
  return merged;
}

/**
 * Returns an array of error strings — empty means "valid". Caller decides
 * whether to throw or log; the main class logs each error and continues so
 * a single bad option doesn't crash the player.
 */
export function validateConfig(config: CI360VideoConfig): string[] {
  const errors: string[] = [];

  // A source can come from either `src` or a non-empty `sources` array; only
  // complain when neither is present (and we're not deferring load).
  const hasSource = !!config.src || (config.sources?.length ?? 0) > 0;
  if (!hasSource && config.autoLoad !== false) {
    errors.push('config.src is required');
  }

  if (
    config.projection &&
    !['equirectangular', 'fisheye', 'dual-fisheye'].includes(config.projection)
  ) {
    errors.push(
      `Invalid projection: "${config.projection}". Must be one of: equirectangular, fisheye, dual-fisheye.`,
    );
  }
  if (config.lensFovDeg !== undefined && (config.lensFovDeg <= 0 || config.lensFovDeg > 360)) {
    errors.push(`lensFovDeg must be in (0, 360], got ${config.lensFovDeg}.`);
  }
  if (
    config.stereo &&
    !['auto', 'mono', 'top-bottom', 'side-by-side'].includes(config.stereo)
  ) {
    errors.push(
      `Invalid stereo: "${config.stereo}". Must be one of: auto, mono, top-bottom, side-by-side.`,
    );
  }
  if (config.theme && !['light', 'dark'].includes(config.theme)) {
    errors.push(`Invalid theme: "${config.theme}". Must be "light" or "dark".`);
  }
  if (
    config.playerType &&
    !['auto', 'html5', 'hls', 'dash'].includes(config.playerType)
  ) {
    errors.push(`Invalid playerType: "${config.playerType}".`);
  }

  // FOV bounds: 0 < fov < 180.
  for (const field of ['fov', 'fovMin', 'fovMax'] as const) {
    const v = config[field];
    if (v !== undefined && (v <= 0 || v >= 180)) {
      errors.push(`${field} must be in (0, 180), got ${v}.`);
    }
  }
  if (
    config.fovMin !== undefined &&
    config.fovMax !== undefined &&
    config.fovMin > config.fovMax
  ) {
    errors.push(`fovMin (${config.fovMin}) must be ≤ fovMax (${config.fovMax}).`);
  }

  // Latitude bounds: -90 ≤ lat ≤ 90.
  for (const field of ['latMin', 'latMax', 'initialLat'] as const) {
    const v = config[field];
    if (v !== undefined && (v < -90 || v > 90)) {
      errors.push(`${field} must be in [-90, 90], got ${v}.`);
    }
  }
  if (
    config.latMin !== undefined &&
    config.latMax !== undefined &&
    config.latMin > config.latMax
  ) {
    errors.push(`latMin (${config.latMin}) must be ≤ latMax (${config.latMax}).`);
  }

  if (config.sphereSegments !== undefined && config.sphereSegments < 8) {
    errors.push(`sphereSegments must be ≥ 8, got ${config.sphereSegments}.`);
  }
  if (config.pixelRatio !== undefined && config.pixelRatio <= 0) {
    errors.push(`pixelRatio must be positive, got ${config.pixelRatio}.`);
  }
  if (config.rotateSpeed !== undefined && config.rotateSpeed < 0) {
    errors.push(`rotateSpeed must be non-negative, got ${config.rotateSpeed}.`);
  }
  if (
    config.dampingFactor !== undefined &&
    (config.dampingFactor <= 0 || config.dampingFactor > 1)
  ) {
    errors.push(`dampingFactor must be in (0, 1], got ${config.dampingFactor}.`);
  }

  return errors;
}
