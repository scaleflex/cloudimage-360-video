import { describe, it, expect, afterEach } from 'vitest';
import { ViewStateManager } from '../src/controls/view-state';
import { createGyroControls, deviceOrientationToView } from '../src/controls/gyro-controls';

describe('deviceOrientationToView', () => {
  it('portrait: alpha → -lon, upright device (beta 90) → lat 0', () => {
    expect(deviceOrientationToView(90, 90, 0, 0)).toEqual({ lon: -90, lat: 0 });
    expect(deviceOrientationToView(0, 120, 0, 0)).toEqual({ lon: 0, lat: 30 });
  });
  it('landscape 90 uses gamma for pitch', () => {
    expect(deviceOrientationToView(0, 0, 30, 90)).toEqual({ lon: 0, lat: -30 });
  });
  it('landscape 270 flips gamma sign', () => {
    expect(deviceOrientationToView(0, 0, 30, 270)).toEqual({ lon: 0, lat: 30 });
  });
  it('upside-down portrait (180) inverts beta', () => {
    expect(deviceOrientationToView(0, 120, 0, 180)).toEqual({ lon: 0, lat: -30 });
  });
});

describe('gyro applies deltas that compose with drag', () => {
  const makeVSM = () =>
    new ViewStateManager({
      initialLon: 0,
      initialLat: 0,
      initialFov: 75,
      fovMin: 30,
      fovMax: 100,
      latMin: -85,
      latMax: 85,
      damping: false,
      dampingFactor: 0.1,
    });

  const fire = (alpha: number, beta: number): void => {
    const ev = new Event('deviceorientation') as Event & {
      alpha: number;
      beta: number;
      gamma: number;
    };
    ev.alpha = alpha;
    ev.beta = beta;
    ev.gamma = 0;
    window.dispatchEvent(ev);
  };

  afterEach(() => {
    delete (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
  });

  it('first sample is a no-move baseline; later samples add deltas, preserving a drag offset', async () => {
    // Make hasDeviceOrientation() true without a permission gate.
    (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent =
      function () {} as unknown;

    const vsm = makeVSM();
    const gyro = createGyroControls(vsm);
    const ok = await gyro.enable();
    expect(ok).toBe(true);

    fire(10, 90); // baseline only — view must not move
    expect(vsm.getTargetView().lon).toBe(0);

    fire(20, 90); // lon -10 → -20 ⇒ delta -10
    expect(vsm.getTargetView().lon).toBe(-10);

    // A manual drag between sensor ticks must NOT be overwritten by gyro.
    vsm.rotateBy(5, 0);
    fire(30, 90); // another -10 delta, added on top of the drag
    expect(vsm.getTargetView().lon).toBe(-15);

    gyro.destroy();
    // After destroy, further events are ignored.
    fire(90, 90);
    expect(vsm.getTargetView().lon).toBe(-15);
  });

  it('re-baselines on a screen orientation change so the view does not jump', async () => {
    // Regression: rotating the device swaps the pitch axis (beta↔gamma); without
    // dropping the baseline, the next sample applied a large bogus delta.
    (window as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent =
      function () {} as unknown;

    const vsm = makeVSM();
    const gyro = createGyroControls(vsm);
    await gyro.enable();

    fire(10, 90); // baseline
    fire(20, 90); // delta -10 → lon -10
    expect(vsm.getTargetView().lon).toBe(-10);

    window.dispatchEvent(new Event('orientationchange')); // device rotated
    fire(50, 90); // would be a -30 jump without rebaseline — must be a no-op baseline
    expect(vsm.getTargetView().lon).toBe(-10);
    fire(60, 90); // now a fresh -10 delta off the new baseline
    expect(vsm.getTargetView().lon).toBe(-20);

    gyro.destroy();
  });
});
