import { describe, it, expect } from 'vitest';
import { PerspectiveCamera } from 'three';
import { ViewStateManager, SPHERE_RADIUS } from '../src/controls/view-state';
import { lonLatToVec3, wrapLon, clamp } from '../src/utils/math';

function makeViewState(overrides: Partial<{ damping: boolean }> = {}): ViewStateManager {
  return new ViewStateManager({
    initialLon: 0,
    initialLat: 0,
    initialFov: 75,
    fovMin: 30,
    fovMax: 100,
    latMin: -85,
    latMax: 85,
    damping: overrides.damping ?? false,
    dampingFactor: 0.1,
  });
}

describe('math helpers', () => {
  it('wrapLon keeps values in (-180, 180]', () => {
    expect(wrapLon(0)).toBe(0);
    expect(wrapLon(180)).toBe(180);
    expect(wrapLon(-180)).toBe(180);
    expect(wrapLon(190)).toBeCloseTo(-170, 5);
    expect(wrapLon(-190)).toBeCloseTo(170, 5);
    expect(wrapLon(540)).toBeCloseTo(180, 5);
  });

  it('lonLatToVec3 puts (0,0) on +Z, (90,0) on +X', () => {
    const [x1, y1, z1] = lonLatToVec3(0, 0, 1);
    expect(x1).toBeCloseTo(0, 5);
    expect(y1).toBeCloseTo(0, 5);
    expect(z1).toBeCloseTo(1, 5);

    const [x2, y2, z2] = lonLatToVec3(90, 0, 1);
    expect(x2).toBeCloseTo(1, 5);
    expect(y2).toBeCloseTo(0, 5);
    expect(z2).toBeCloseTo(0, 5);
  });

  it('lonLatToVec3 puts (0, 90) at +Y (zenith)', () => {
    const [x, y, z] = lonLatToVec3(0, 90, 1);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(1, 5);
    expect(z).toBeCloseTo(0, 5);
  });

  it('clamp clamps', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('ViewStateManager', () => {
  it('clamps initial values to limits', () => {
    const v = new ViewStateManager({
      initialLon: 0, initialLat: 90, initialFov: 200,
      fovMin: 30, fovMax: 100, latMin: -85, latMax: 85,
      damping: false, dampingFactor: 0.1,
    });
    const view = v.getView();
    expect(view.lat).toBe(85);
    expect(view.fov).toBe(100);
  });

  it('rotateBy accumulates and clamps lat', () => {
    const v = makeViewState();
    v.rotateBy(45, 50);
    v.step(1 / 60);
    expect(v.getView().lon).toBeCloseTo(45, 5);
    expect(v.getView().lat).toBeCloseTo(50, 5);
    // Push above latMax — should clamp.
    v.rotateBy(0, 100);
    v.step(1 / 60);
    expect(v.getView().lat).toBe(85);
  });

  it('zoomBy clamps fov', () => {
    const v = makeViewState();
    v.zoomBy(-1000);
    v.step(1 / 60);
    expect(v.getView().fov).toBe(30);
    v.zoomBy(1000);
    v.step(1 / 60);
    expect(v.getView().fov).toBe(100);
  });

  it('setView({...}, snap=true) jumps without interpolation even with damping on', () => {
    const v = makeViewState({ damping: true });
    v.setView({ lon: 90, lat: 30, fov: 60 }, true);
    const view = v.getView();
    expect(view.lon).toBeCloseTo(90, 5);
    expect(view.lat).toBeCloseTo(30, 5);
    expect(view.fov).toBeCloseTo(60, 5);
  });

  it('step lerps toward target with damping', () => {
    const v = makeViewState({ damping: true });
    v.setView({ lon: 100 }, false);
    // After one tick the current value should have moved part-way (not jumped).
    v.step(1 / 60);
    const after = v.getView().lon;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(100);
  });

  it('latLonToScreen — point directly ahead is visible at screen centre', () => {
    const v = makeViewState();
    const camera = new PerspectiveCamera(75, 16 / 9, 0.1, 1100);
    camera.position.set(0, 0, 0);
    v.applyToCamera(camera); // looking at (0, 0)
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    const p = v.latLonToScreen(camera, container, 0, 0);
    expect(p.visible).toBe(true);
    expect(p.x).toBeCloseTo(400, 0);
    expect(p.y).toBeCloseTo(300, 0);
  });

  it('latLonToScreen — point directly behind is reported not visible', () => {
    const v = makeViewState();
    const camera = new PerspectiveCamera(75, 16 / 9, 0.1, 1100);
    camera.position.set(0, 0, 0);
    v.applyToCamera(camera);
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    // Looking at +Z; (lon=180) is at -Z → behind.
    const p = v.latLonToScreen(camera, container, 180, 0);
    expect(p.visible).toBe(false);
  });

  it('SPHERE_RADIUS is the project-wide constant', () => {
    expect(SPHERE_RADIUS).toBeGreaterThan(0);
  });
});
