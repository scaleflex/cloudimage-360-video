import type { ViewStateManager } from './view-state';
import { deviceOrientationNeedsPermission, hasDeviceOrientation } from '../utils/capabilities';
import { wrapLon } from '../utils/math';

export interface GyroControlsHandle {
  /** Returns true on successful activation, false if unsupported or denied.
   *  Must be called from a user-gesture handler on iOS 13+. */
  enable: () => Promise<boolean>;
  disable: () => void;
  isEnabled: () => boolean;
  destroy: () => void;
}

/**
 * Map a single `DeviceOrientationEvent` sample to an absolute `(lon, lat)`.
 *
 * `alpha` (compass, around the screen-normal) drives longitude; pitch drives
 * latitude. Which raw axis carries pitch depends on how the screen is rotated,
 * so `screenAngle` (0 / 90 / 180 / 270, from `screen.orientation.angle`) is
 * folded in. This is a deliberately simple model — good enough for casual
 * handheld viewing; full quaternion sensor-fusion can replace it without
 * touching the rest of this file.
 *
 * Pure function → unit-testable without a device.
 */
export function deviceOrientationToView(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle = 0,
): { lon: number; lat: number } {
  const lon = -alpha;
  let lat: number;
  switch (((screenAngle % 360) + 360) % 360) {
    case 90:
      lat = -gamma; // rotated clockwise into landscape
      break;
    case 270:
      lat = gamma; // rotated counter-clockwise into landscape
      break;
    case 180:
      lat = 90 - beta; // upside-down portrait
      break;
    default:
      lat = beta - 90; // upright portrait (device upright → lat 0)
  }
  // `|| 0` normalizes negative zero (e.g. `-alpha` when alpha is 0) to +0.
  return { lon: lon || 0, lat: lat || 0 };
}

function getScreenAngle(): number {
  if (
    typeof screen !== 'undefined' &&
    screen.orientation &&
    typeof screen.orientation.angle === 'number'
  ) {
    return screen.orientation.angle;
  }
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

/**
 * Map device orientation to the player's `(lon, lat)` view-state.
 *
 * iOS 13+ gates `DeviceOrientationEvent` behind a permission prompt that must
 * be triggered from a user gesture (a click handler) — `enable()` invokes it
 * and resolves with the granted state.
 *
 * Each sample is applied as a **delta** (`rotateBy`) rather than an absolute
 * `setView`. That lets gyro motion compose with manual drag and auto-rotate —
 * which also feed `rotateBy` — instead of every sensor tick stomping whatever
 * the user just dragged. The first sample only establishes a baseline, so
 * enabling gyro never makes the view jump.
 */
export function createGyroControls(view: ViewStateManager): GyroControlsHandle {
  let enabled = false;
  let prevLon: number | null = null;
  let prevLat: number | null = null;

  const onOrientation = (e: DeviceOrientationEvent): void => {
    if (!enabled) return;
    const { alpha, beta, gamma } = e;
    if (alpha == null || beta == null) return;
    const { lon, lat } = deviceOrientationToView(alpha, beta, gamma ?? 0, getScreenAngle());

    // First sample after enable: record baseline, don't move the view.
    if (prevLon === null || prevLat === null) {
      prevLon = lon;
      prevLat = lat;
      return;
    }

    // Shortest-arc longitude delta so a 359°→1° compass step rotates +2°, not -358°.
    const dLon = wrapLon(lon - prevLon);
    const dLat = lat - prevLat;
    prevLon = lon;
    prevLat = lat;
    view.rotateBy(dLon, dLat);
  };

  const attach = (): void => {
    window.addEventListener('deviceorientation', onOrientation, true);
  };
  const detach = (): void => {
    window.removeEventListener('deviceorientation', onOrientation, true);
  };

  return {
    enable: async () => {
      if (!hasDeviceOrientation()) return false;
      if (deviceOrientationNeedsPermission()) {
        try {
          const res = await (DeviceOrientationEvent as any).requestPermission();
          if (res !== 'granted') return false;
        } catch {
          return false;
        }
      }
      if (!enabled) {
        enabled = true;
        prevLon = null;
        prevLat = null;
        attach();
      }
      return true;
    },
    disable: () => {
      if (!enabled) return;
      enabled = false;
      prevLon = null;
      prevLat = null;
      detach();
    },
    isEnabled: () => enabled,
    destroy: () => {
      if (enabled) detach();
      enabled = false;
      prevLon = null;
      prevLat = null;
    },
  };
}
