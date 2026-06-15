import { VideoTexture, SRGBColorSpace, LinearFilter, ClampToEdgeWrapping } from 'three';
import { hasRequestVideoFrameCallback } from '../utils/capabilities';

export interface VideoTextureHandle {
  texture: VideoTexture;
  /** Returns `true` if a new video frame was made available to the GPU. */
  update: () => boolean;
  destroy: () => void;
}

/**
 * Create a sRGB `VideoTexture` and wire up frame-driven uploads.
 *
 * When `<video>.requestVideoFrameCallback` is available (Chrome, Edge, Safari)
 * we only flip `needsUpdate = true` when the browser tells us a new decoded
 * frame is ready. That avoids re-uploading the same 4K texture every animation
 * tick — uploads are the hot path on 360 playback.
 *
 * Older browsers fall back to "mark dirty every tick" — Three.js will skip the
 * upload internally when the video isn't ready, so this is safe.
 *
 * `maxAnisotropy` (pass `renderer.capabilities.getMaxAnisotropy()`) enables
 * anisotropic filtering. On a sphere viewed from the inside, the poles and the
 * periphery of a wide view are sampled at grazing angles, where plain bilinear
 * filtering smears texels — which reads as the edges "stretching". Anisotropic
 * filtering samples along the projected footprint and keeps those regions sharp.
 */
export function createVideoTexture(
  video: HTMLVideoElement,
  maxAnisotropy = 0,
): VideoTextureHandle {
  const texture = new VideoTexture(video);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  // Clamp to the driver's supported max; >1 is a no-op on hardware without the
  // EXT_texture_filter_anisotropic extension, so this is always safe.
  if (maxAnisotropy > 1) texture.anisotropy = maxAnisotropy;

  const useRVFC = hasRequestVideoFrameCallback();
  let newFrameReady = true; // upload at least once at start
  let rvfcId: number | null = null;
  let cancelled = false;

  const requestNext = (): void => {
    if (!useRVFC || cancelled) return;
    rvfcId = (video as any).requestVideoFrameCallback(() => {
      if (cancelled) return;
      newFrameReady = true;
      requestNext();
    });
  };
  if (useRVFC) requestNext();

  return {
    texture,
    update: () => {
      if (useRVFC) {
        if (newFrameReady) {
          newFrameReady = false;
          texture.needsUpdate = true;
          return true;
        }
        return false;
      }
      texture.needsUpdate = true;
      return true;
    },
    destroy: () => {
      cancelled = true;
      if (
        useRVFC &&
        rvfcId !== null &&
        typeof (video as any).cancelVideoFrameCallback === 'function'
      ) {
        (video as any).cancelVideoFrameCallback(rvfcId);
      }
      texture.dispose();
    },
  };
}
