export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function degToRad(deg: number): number {
  return deg * DEG2RAD;
}

export function radToDeg(rad: number): number {
  return rad * RAD2DEG;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Wrap a longitude angle into (-180, 180]. Used so that drag deltas can
 * accumulate freely without the value drifting toward ±∞.
 */
export function wrapLon(lon: number): number {
  let v = ((lon + 180) % 360 + 360) % 360 - 180;
  // (-180,180] convention: map exact -180 to 180
  if (v === -180) v = 180;
  return v;
}

/**
 * Equirectangular spherical coordinates → cartesian on a sphere of given radius.
 * Convention: lat in [-90, 90] where +90 is "up" (zenith); lon in degrees,
 * 0 facing +Z (default camera-look direction in Three.js).
 *
 * Returns [x, y, z]. This is the single source of truth that ties the public
 * `{lon, lat}` contract to Three.js camera math.
 */
export function lonLatToVec3(
  lon: number,
  lat: number,
  radius: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const phi = degToRad(90 - lat);
  const theta = degToRad(lon);
  const sinPhi = Math.sin(phi);
  out[0] = radius * sinPhi * Math.sin(theta);
  out[1] = radius * Math.cos(phi);
  out[2] = radius * sinPhi * Math.cos(theta);
  return out;
}
