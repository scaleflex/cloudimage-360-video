import { SphereGeometry, ShaderMaterial, BackSide, type Texture } from 'three';
import type { Projection } from './projection';
import { registerProjection } from './projection';

/**
 * Fisheye projection family.
 *
 * Raw output from 360° cameras (Ricoh Theta, Insta360, GoPro MAX in pre-stitch
 * mode) comes as a fisheye image — typically **dual-fisheye** (two
 * back-to-back hemispherical lenses laid side-by-side). Some single-lens
 * action cams output **single fisheye** at 180°.
 *
 * Geometry is the same sphere as equirectangular. Difference is the
 * `ShaderMaterial` that, per fragment, computes the inverse fisheye mapping
 * (sphere direction → polar coords in the source circle) and samples the
 * texture there.
 *
 * Inside-out rendering: we use `side: BackSide` rather than the
 * `geometry.scale(-1, 1, 1)` trick used by equirectangular. Reason: the
 * shader works in raw geometry space, so any axis flip would have to be
 * reversed inside the shader. BackSide keeps the math clean.
 */

const VERTEX_SHADER = /* glsl */ `
varying vec3 vDir;
void main() {
  // Sphere centred at origin → world direction == local position direction.
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// sRGB → linear → output conversion is done explicitly here to stay
// independent of Three.js shader-chunk version. Equivalent to what
// `<colorspace_fragment>` does, but with no version-coupling risk.
const COLOR_HELPERS = /* glsl */ `
#define PI 3.141592653589793

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 sampleSrgb(sampler2D tex, vec2 uv) {
  return srgbToLinear(texture2D(tex, uv).rgb);
}
`;

const DUAL_FRAGMENT_SHADER = /* glsl */ `
${COLOR_HELPERS}

varying vec3 vDir;
uniform sampler2D map;
uniform float lensFovDeg;
uniform float seamBlendDeg;

void main() {
  vec3 dir = normalize(vDir);
  // max(...,1.0) guards against lensFovDeg==0 → halfFov==0 → division by zero.
  float halfFov = (max(lensFovDeg, 1.0) * 0.5) * (PI / 180.0);

  // Front lens looks along +Z. Polar angle from +Z and azimuth around it.
  // Clamp r to the lens circle: in the seam blend band a direction can have
  // phi > halfFov (r > 1), which without the clamp samples past 0.5 into the
  // *other* lens's half of the frame, producing a ghosted ring at the equator.
  float phi_f = acos(clamp(dir.z, -1.0, 1.0));
  float psi_f = atan(dir.y, dir.x);
  float r_f = min(phi_f / halfFov, 1.0);
  vec2 uv_f = vec2(0.25 + 0.25 * r_f * cos(psi_f),
                   0.5  + 0.5  * r_f * sin(psi_f));

  // Back lens looks along -Z. Physical 180° rotation means we mirror x.
  float phi_b = acos(clamp(-dir.z, -1.0, 1.0));
  float psi_b = atan(dir.y, -dir.x);
  float r_b = min(phi_b / halfFov, 1.0);
  vec2 uv_b = vec2(0.75 + 0.25 * r_b * cos(psi_b),
                   0.5  + 0.5  * r_b * sin(psi_b));

  // Smooth blend ±seamBlendDeg around the equator (dir.z ≈ 0).
  float blendHW = sin(seamBlendDeg * (PI / 180.0));
  float w = smoothstep(-blendHW, blendHW, dir.z);

  vec3 colorFront = sampleSrgb(map, uv_f);
  vec3 colorBack  = sampleSrgb(map, uv_b);
  vec3 color = mix(colorBack, colorFront, w);

  gl_FragColor = vec4(linearToSrgb(color), 1.0);
}
`;

const SINGLE_FRAGMENT_SHADER = /* glsl */ `
${COLOR_HELPERS}

varying vec3 vDir;
uniform sampler2D map;
uniform float lensFovDeg;

void main() {
  vec3 dir = normalize(vDir);
  vec3 color = vec3(0.0); // outside the lens circle — black

  // max(...,1.0) guards against lensFovDeg==0 → halfFov==0 → division by zero.
  float halfFov = (max(lensFovDeg, 1.0) * 0.5) * (PI / 180.0);
  float phi = acos(clamp(dir.z, -1.0, 1.0));
  float psi = atan(dir.y, dir.x);
  float r = phi / halfFov;
  // Gate on the circle radius (r <= 1), not the hemisphere (dir.z >= 0): a
  // narrow lens (<180°) stops short of the equator instead of smearing edge
  // pixels in a ring; a wide lens (>180°) keeps the coverage it has past dir.z=0.
  if (r <= 1.0) {
    // Single fisheye fills the whole frame as one circle centred at (0.5, 0.5).
    vec2 uv = vec2(0.5 + 0.5 * r * cos(psi),
                   0.5 + 0.5 * r * sin(psi));
    color = sampleSrgb(map, uv);
  }

  gl_FragColor = vec4(linearToSrgb(color), 1.0);
}
`;

function createSphereGeometry(segments: number, radius: number): SphereGeometry {
  const wSeg = Math.max(8, segments);
  const hSeg = Math.max(8, Math.floor(segments / 2));
  // No geometry.scale(-1,1,1) here — `side: BackSide` does the inside-out work.
  return new SphereGeometry(radius, wSeg, hSeg);
}

export const FisheyeProjection: Projection = {
  name: 'fisheye',

  createGeometry({ segments, radius }) {
    return createSphereGeometry(segments, radius);
  },

  createMaterial(texture: Texture, opts) {
    return new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: SINGLE_FRAGMENT_SHADER,
      uniforms: {
        map: { value: texture },
        lensFovDeg: { value: opts?.lensFovDeg ?? 180 },
      },
      side: BackSide,
    });
  },
};

export const DualFisheyeProjection: Projection = {
  name: 'dual-fisheye',

  createGeometry({ segments, radius }) {
    return createSphereGeometry(segments, radius);
  },

  createMaterial(texture: Texture, opts) {
    return new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: DUAL_FRAGMENT_SHADER,
      uniforms: {
        map: { value: texture },
        lensFovDeg: { value: opts?.lensFovDeg ?? 180 },
        seamBlendDeg: { value: 5 },
      },
      side: BackSide,
    });
  },
};

// Side-effect registration. `core/ci-360-video.ts` imports this file once at
// startup so `getProjection('fisheye' | 'dual-fisheye')` works from anywhere.
registerProjection(FisheyeProjection);
registerProjection(DualFisheyeProjection);
