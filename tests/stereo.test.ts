import { describe, it, expect } from 'vitest';
import { Texture } from 'three';
import { mapUVForEye } from '../src/texture/eye-mapping';

function makeTexture(): Texture {
  const t = new Texture();
  // Pre-perturb offset/repeat so we can detect when mapUVForEye sets them.
  t.offset.set(0.123, 0.456);
  t.repeat.set(0.789, 0.321);
  return t;
}

describe('mapUVForEye', () => {
  it('mono — resets offset to (0,0) and repeat to (1,1)', () => {
    const t = makeTexture();
    mapUVForEye(t, 'mono', 'mono');
    expect(t.offset.x).toBe(0);
    expect(t.offset.y).toBe(0);
    expect(t.repeat.x).toBe(1);
    expect(t.repeat.y).toBe(1);
  });

  it('top-bottom + left → samples upper half (offset.y=0.5, repeat.y=0.5)', () => {
    const t = makeTexture();
    mapUVForEye(t, 'left', 'top-bottom');
    expect(t.offset.x).toBe(0);
    expect(t.offset.y).toBe(0.5);
    expect(t.repeat.x).toBe(1);
    expect(t.repeat.y).toBe(0.5);
  });

  it('top-bottom + right → samples lower half', () => {
    const t = makeTexture();
    mapUVForEye(t, 'right', 'top-bottom');
    expect(t.offset.x).toBe(0);
    expect(t.offset.y).toBe(0);
    expect(t.repeat.x).toBe(1);
    expect(t.repeat.y).toBe(0.5);
  });

  it('side-by-side + left → samples left half (repeat.x=0.5)', () => {
    const t = makeTexture();
    mapUVForEye(t, 'left', 'side-by-side');
    expect(t.offset.x).toBe(0);
    expect(t.offset.y).toBe(0);
    expect(t.repeat.x).toBe(0.5);
    expect(t.repeat.y).toBe(1);
  });

  it('side-by-side + right → samples right half (offset.x=0.5, repeat.x=0.5)', () => {
    const t = makeTexture();
    mapUVForEye(t, 'right', 'side-by-side');
    expect(t.offset.x).toBe(0.5);
    expect(t.offset.y).toBe(0);
    expect(t.repeat.x).toBe(0.5);
    expect(t.repeat.y).toBe(1);
  });

  it('mono short-circuits even when an eye is specified', () => {
    const t = makeTexture();
    mapUVForEye(t, 'left', 'mono');
    expect(t.repeat.x).toBe(1);
    expect(t.repeat.y).toBe(1);
  });

  it('changing layout at runtime updates the sampling window', () => {
    const t = makeTexture();
    // Start in TB-left (top half)…
    mapUVForEye(t, 'left', 'top-bottom');
    expect(t.offset.y).toBe(0.5);
    // …switch to SBS-left (left half) — both axes should reflect the new layout.
    mapUVForEye(t, 'left', 'side-by-side');
    expect(t.offset.x).toBe(0);
    expect(t.offset.y).toBe(0);
    expect(t.repeat.x).toBe(0.5);
    expect(t.repeat.y).toBe(1);
  });
});
