import { describe, it, expect } from 'vitest';
import { ShaderMaterial, SphereGeometry, Texture, BackSide } from 'three';
import { getProjection } from '../src/projection/projection';
import '../src/projection/fisheye'; // side-effect: register

describe('Fisheye projection family', () => {
  it('registers both fisheye and dual-fisheye in the projection registry', () => {
    expect(getProjection('fisheye').name).toBe('fisheye');
    expect(getProjection('dual-fisheye').name).toBe('dual-fisheye');
  });

  it('createGeometry returns a SphereGeometry (no scale trick — uses BackSide)', () => {
    const p = getProjection('dual-fisheye');
    const g = p.createGeometry({ segments: 32, radius: 500 });
    expect(g).toBeInstanceOf(SphereGeometry);
    expect(g.attributes.position.count).toBeGreaterThan(0);
  });

  it('createMaterial returns a BackSide ShaderMaterial with required uniforms', () => {
    const p = getProjection('dual-fisheye');
    const tex = new Texture();
    const mat = p.createMaterial(tex, { lensFovDeg: 200 }) as ShaderMaterial;
    expect(mat).toBeInstanceOf(ShaderMaterial);
    expect(mat.side).toBe(BackSide);
    expect(mat.uniforms.map.value).toBe(tex);
    expect(mat.uniforms.lensFovDeg.value).toBe(200);
    expect(mat.uniforms.seamBlendDeg.value).toBeGreaterThan(0);
  });

  it('single fisheye material has no seamBlendDeg uniform', () => {
    const p = getProjection('fisheye');
    const tex = new Texture();
    const mat = p.createMaterial(tex) as ShaderMaterial;
    expect(mat).toBeInstanceOf(ShaderMaterial);
    expect(mat.uniforms.map.value).toBe(tex);
    expect(mat.uniforms.lensFovDeg.value).toBe(180);
    expect(mat.uniforms.seamBlendDeg).toBeUndefined();
  });

  it('defaults lensFovDeg to 180 when not passed', () => {
    const p = getProjection('dual-fisheye');
    const tex = new Texture();
    const mat = p.createMaterial(tex) as ShaderMaterial;
    expect(mat.uniforms.lensFovDeg.value).toBe(180);
  });
});
