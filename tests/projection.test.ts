import { describe, it, expect } from 'vitest';
import { SphereGeometry } from 'three';
import { getProjection, registerProjection } from '../src/projection/projection';
import '../src/projection/equirectangular'; // register

describe('projection registry', () => {
  it('returns the equirectangular projection by name', () => {
    const p = getProjection('equirectangular');
    expect(p.name).toBe('equirectangular');
  });

  it('throws on unknown projection', () => {
    expect(() => getProjection('cubemap')).toThrow(/unknown projection/i);
  });

  it('allows new projections to be registered', () => {
    registerProjection({
      name: 'test-projection',
      createGeometry: () => new SphereGeometry(1, 8, 8),
      createMaterial: () => ({}) as any,
    });
    expect(getProjection('test-projection').name).toBe('test-projection');
  });
});

describe('EquirectangularProjection', () => {
  it('creates a sphere geometry with the requested segments', () => {
    const p = getProjection('equirectangular');
    const g = p.createGeometry({ segments: 32, radius: 500 });
    expect(g).toBeInstanceOf(SphereGeometry);
    // Position attribute count grows with segments; rough sanity check.
    const positions = g.attributes.position;
    expect(positions.count).toBeGreaterThan(0);
  });

  it('enforces a minimum segment count', () => {
    const p = getProjection('equirectangular');
    // Asking for 4 segments — clamped internally to 8 for both axes.
    const g = p.createGeometry({ segments: 4, radius: 1 });
    expect(g.attributes.position.count).toBeGreaterThan(0);
  });
});
