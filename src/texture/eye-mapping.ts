import type { Texture } from 'three';

export type Eye = 'mono' | 'left' | 'right';
export type StereoLayout = 'mono' | 'top-bottom' | 'side-by-side';

/**
 * Adjust a video texture's UV sampling window for the requested eye in a
 * stereoscopic source.
 *
 * In v1.1 the player always renders a single eye (the **left** by default) onto
 * the existing sphere — this gives a non-VR "mono view" of stereo content,
 * which is the right behaviour until VR rendering is wired up. When VR ships,
 * the same function will be called twice per frame (once per eye, with the
 * 'right' value) to produce the per-eye render.
 *
 * Implementation note: we use `Texture.offset` + `Texture.repeat` so the GPU
 * does the UV crop via Three.js's built-in texture matrix — no geometry or
 * UV-attribute edits, no custom shader. `Texture.matrixAutoUpdate = true` (the
 * default) means the matrix is rebuilt each frame, so we don't have to flag
 * `needsUpdate` after editing the window.
 *
 * Convention (VR industry standard):
 *   - **top-bottom**: left eye = TOP half, right eye = BOTTOM half.
 *   - **side-by-side**: left eye = LEFT half, right eye = RIGHT half.
 *
 * `VideoTexture` defaults to `flipY = true`, which makes the V coordinate
 * run 0 (visual bottom) → 1 (visual top). So "top half" = `V ∈ [0.5, 1]`.
 */
export function mapUVForEye(texture: Texture, eye: Eye, layout: StereoLayout): void {
  // Mono — restore identity so swapping configs at runtime can't strand a
  // texture in a half-sampled state.
  if (eye === 'mono' || layout === 'mono') {
    texture.offset.set(0, 0);
    texture.repeat.set(1, 1);
      return;
  }

  if (layout === 'top-bottom') {
    if (eye === 'left') {
      texture.offset.set(0, 0.5);
      texture.repeat.set(1, 0.5);
    } else {
      // right eye = bottom half
      texture.offset.set(0, 0);
      texture.repeat.set(1, 0.5);
    }
  } else if (layout === 'side-by-side') {
    if (eye === 'left') {
      texture.offset.set(0, 0);
      texture.repeat.set(0.5, 1);
    } else {
      // right eye = right half
      texture.offset.set(0.5, 0);
      texture.repeat.set(0.5, 1);
    }
  }

}
