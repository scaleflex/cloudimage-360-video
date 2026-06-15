import { SphereGeometry, MeshBasicMaterial, type Texture } from 'three';
import type { Projection } from './projection';
import { registerProjection } from './projection';
import { mapUVForEye } from '../texture/eye-mapping';

/**
 * Equirectangular (2:1) projection.
 *
 * Rendering trick: `geometry.scale(-1, 1, 1)` mirrors the sphere along X,
 * which inverts its normals. Combined with the default FrontSide material,
 * this is the canonical Three.js panorama recipe — viewed from the origin,
 * the texture appears in its natural orientation rather than mirrored.
 *
 * Reference: Three.js `webgl_video_panorama_equirectangular` example.
 */
export const EquirectangularProjection: Projection = {
  name: 'equirectangular',

  createGeometry({ segments, radius }) {
    const widthSegments = Math.max(8, segments);
    const heightSegments = Math.max(8, Math.floor(segments / 2));
    const geometry = new SphereGeometry(radius, widthSegments, heightSegments);
    geometry.scale(-1, 1, 1);
    return geometry;
  },

  createMaterial(texture: Texture, opts) {
    // Default eye is 'left' for stereo sources, but identity for mono — the
    // function itself short-circuits on layout === 'mono'.
    const layout = opts?.layout ?? 'mono';
    const eye = opts?.eye ?? (layout === 'mono' ? 'mono' : 'left');
    mapUVForEye(texture, eye, layout);
    return new MeshBasicMaterial({ map: texture });
  },
};

// Side-effect registration. ci-360-video.ts imports this file once at startup;
// after that `getProjection('equirectangular')` works from anywhere.
registerProjection(EquirectangularProjection);
