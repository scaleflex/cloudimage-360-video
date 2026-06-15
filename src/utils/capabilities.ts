import { isBrowser } from './dom';

/**
 * Feature/device detection used to gate optional behaviour
 * (gyroscope, WebXR, max-texture warnings).
 *
 * These helpers are pure functions of the environment, not the config,
 * so they can be called once at construction time.
 */

export function hasWebGL(): boolean {
  if (!isBrowser()) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Probe `gl.MAX_TEXTURE_SIZE` once. Used to warn when source video resolution
 *  exceeds GPU limits (common on mobile, where the cap is often 4096). */
export function getMaxTextureSize(): number {
  if (!isBrowser()) return 0;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) return 0;
    return gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  } catch {
    return 0;
  }
}

export function isTouchDevice(): boolean {
  if (!isBrowser()) return false;
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
}

export function hasDeviceOrientation(): boolean {
  if (!isBrowser()) return false;
  return typeof window.DeviceOrientationEvent !== 'undefined';
}

/** iOS 13+ exposes a permission gate for DeviceOrientation. */
export function deviceOrientationNeedsPermission(): boolean {
  if (!isBrowser() || !hasDeviceOrientation()) return false;
  return typeof (DeviceOrientationEvent as any).requestPermission === 'function';
}

export function hasWebXR(): boolean {
  if (!isBrowser()) return false;
  return 'xr' in navigator;
}

/** Browser supports `<video>.requestVideoFrameCallback` (Chrome/Safari/Edge).
 *  When false the texture is updated every animation tick instead. */
export function hasRequestVideoFrameCallback(): boolean {
  if (!isBrowser()) return false;
  return typeof (HTMLVideoElement.prototype as any).requestVideoFrameCallback === 'function';
}

/** Effective device pixel ratio, clamped to a sensible max to avoid burning GPU. */
export function getDevicePixelRatio(maxRatio = 2): number {
  if (!isBrowser()) return 1;
  return Math.min(window.devicePixelRatio || 1, maxRatio);
}

export interface VideoGpuFitReport {
  fits: boolean;
  videoW: number;
  videoH: number;
  max: number;
}

/**
 * Compare the loaded video's intrinsic resolution against the device's
 * `gl.MAX_TEXTURE_SIZE`.
 *
 * When either dimension exceeds the limit the GPU driver will down-scale
 * (often via low-quality bilinear), producing visibly blurry results. The
 * caller can surface this as a passive warning so the user understands the
 * cause without us silently failing.
 *
 * Pure function — no side effects, easy to unit-test with mocked inputs.
 */
export function checkVideoFitsGpu(
  video: HTMLVideoElement,
  maxTextureSize: number,
): VideoGpuFitReport {
  const videoW = video.videoWidth || 0;
  const videoH = video.videoHeight || 0;
  const fits = maxTextureSize > 0 && videoW <= maxTextureSize && videoH <= maxTextureSize;
  return { fits, videoW, videoH, max: maxTextureSize };
}
