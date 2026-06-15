import { type PerspectiveCamera, Vector3 } from 'three';
import type { ViewState, ScreenPoint } from '../core/types';
import { clamp, lerp, lonLatToVec3, wrapLon } from '../utils/math';

/**
 * Sphere radius used for both the rendered geometry and the math that maps
 * `(lon, lat)` to a 3D point. Hardcoded as a project-wide constant so the
 * mesh and the view-state always agree.
 */
export const SPHERE_RADIUS = 500;

export interface ViewStateOptions {
  initialLon: number;
  initialLat: number;
  initialFov: number;
  fovMin: number;
  fovMax: number;
  latMin: number;
  latMax: number;
  damping: boolean;
  /** Fraction smoothed per 60Hz tick; effectively the lerp alpha at 16 ms. */
  dampingFactor: number;
}

/**
 * Owns the public coordinate contract.
 *
 * Two snapshots live here: `target` (where the user wants to look — updated
 * by controls, gyro, keyboard, `setView`) and `current` (what the camera
 * actually shows — interpolated toward target if damping is on).
 *
 * `step()` advances the interpolation; `applyToCamera()` writes the current
 * snapshot into the Three.js camera. Calls are split so the render loop can
 * decide the order (e.g. apply gyro after damping).
 */
export class ViewStateManager {
  private targetLon: number;
  private targetLat: number;
  private targetFov: number;
  private curLon: number;
  private curLat: number;
  private curFov: number;

  private opts: ViewStateOptions;
  private readonly tmpTarget = new Vector3();
  private readonly tmpFwd = new Vector3();
  private readonly tmpPoint = new Vector3();

  constructor(opts: ViewStateOptions) {
    this.opts = { ...opts };
    const initLat = clamp(opts.initialLat, opts.latMin, opts.latMax);
    const initFov = clamp(opts.initialFov, opts.fovMin, opts.fovMax);
    this.targetLon = this.curLon = wrapLon(opts.initialLon);
    this.targetLat = this.curLat = initLat;
    this.targetFov = this.curFov = initFov;
  }

  updateOptions(patch: Partial<ViewStateOptions>): void {
    Object.assign(this.opts, patch);
    // Re-clamp targets in case limits tightened.
    this.targetLat = clamp(this.targetLat, this.opts.latMin, this.opts.latMax);
    this.targetFov = clamp(this.targetFov, this.opts.fovMin, this.opts.fovMax);
  }

  /** Relative change from a drag/keyboard input. */
  rotateBy(deltaLon: number, deltaLat: number): void {
    this.targetLon = wrapLon(this.targetLon + deltaLon);
    this.targetLat = clamp(this.targetLat + deltaLat, this.opts.latMin, this.opts.latMax);
  }

  /** Relative FOV change (wheel/pinch). Positive = zoom out. */
  zoomBy(deltaFov: number): void {
    this.targetFov = clamp(this.targetFov + deltaFov, this.opts.fovMin, this.opts.fovMax);
  }

  /** Absolute set. `snap=true` skips damping and jumps immediately. */
  setView(view: Partial<ViewState>, snap = false): void {
    if (view.lon !== undefined) this.targetLon = wrapLon(view.lon);
    if (view.lat !== undefined) this.targetLat = clamp(view.lat, this.opts.latMin, this.opts.latMax);
    if (view.fov !== undefined) this.targetFov = clamp(view.fov, this.opts.fovMin, this.opts.fovMax);
    if (snap) {
      this.curLon = this.targetLon;
      this.curLat = this.targetLat;
      this.curFov = this.targetFov;
    }
  }

  getView(): ViewState {
    return { lon: this.curLon, lat: this.curLat, fov: this.curFov };
  }

  getTargetView(): ViewState {
    return { lon: this.targetLon, lat: this.targetLat, fov: this.targetFov };
  }

  /** Step the current snapshot toward the target by `dt` seconds.
   *  Returns true if any value changed (caller uses this to throttle `onViewChange`). */
  step(dt: number): boolean {
    if (!this.opts.damping) {
      const changed =
        this.curLon !== this.targetLon ||
        this.curLat !== this.targetLat ||
        this.curFov !== this.targetFov;
      this.curLon = this.targetLon;
      this.curLat = this.targetLat;
      this.curFov = this.targetFov;
      return changed;
    }

    // Frame-rate-independent exponential smoothing.
    // At 60Hz this yields ≈ dampingFactor per tick; at any other rate it
    // converges to the same wall-clock time-constant.
    const k = -Math.log(1 - this.opts.dampingFactor) * 60;
    const alpha = 1 - Math.exp(-k * Math.max(dt, 1 / 240));

    const beforeLon = this.curLon;
    const beforeLat = this.curLat;
    const beforeFov = this.curFov;

    // Shortest-arc lerp for longitude to avoid the 179°→-179° "long way" jump.
    const dLon = wrapLon(this.targetLon - this.curLon);
    this.curLon = wrapLon(this.curLon + dLon * alpha);
    this.curLat = lerp(this.curLat, this.targetLat, alpha);
    this.curFov = lerp(this.curFov, this.targetFov, alpha);

    // Snap when within sub-pixel of target to avoid endless tiny updates.
    const EPS = 1e-3;
    if (Math.abs(wrapLon(this.curLon - this.targetLon)) < EPS) this.curLon = this.targetLon;
    if (Math.abs(this.curLat - this.targetLat) < EPS) this.curLat = this.targetLat;
    if (Math.abs(this.curFov - this.targetFov) < EPS) this.curFov = this.targetFov;

    return (
      this.curLon !== beforeLon || this.curLat !== beforeLat || this.curFov !== beforeFov
    );
  }

  /** Apply the current snapshot to the Three.js camera. */
  applyToCamera(camera: PerspectiveCamera): void {
    const [tx, ty, tz] = lonLatToVec3(this.curLon, this.curLat, SPHERE_RADIUS);
    this.tmpTarget.set(tx, ty, tz);
    camera.lookAt(this.tmpTarget);

    if (Math.abs(camera.fov - this.curFov) > 1e-3) {
      camera.fov = this.curFov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * Project a sphere point at `(lon, lat)` to container-pixel coordinates.
   * Foundation for the future hotspot/overlay layer — caller can decide whether
   * to render the overlay based on `visible`.
   */
  latLonToScreen(
    camera: PerspectiveCamera,
    container: HTMLElement,
    lon: number,
    lat: number,
  ): ScreenPoint {
    const [px, py, pz] = lonLatToVec3(lon, lat, SPHERE_RADIUS);
    this.tmpPoint.set(px, py, pz);

    // Camera is at origin → point in world == direction to point. Compare
    // against camera forward to decide "behind".
    camera.getWorldDirection(this.tmpFwd);
    const behind = this.tmpFwd.dot(this.tmpPoint) < 0;

    this.tmpPoint.project(camera);
    const w = container.clientWidth;
    const h = container.clientHeight;
    const x = ((this.tmpPoint.x + 1) / 2) * w;
    const y = ((1 - this.tmpPoint.y) / 2) * h;
    const inFrustum =
      this.tmpPoint.x >= -1 &&
      this.tmpPoint.x <= 1 &&
      this.tmpPoint.y >= -1 &&
      this.tmpPoint.y <= 1;

    return { x, y, visible: !behind && inFrustum };
  }
}
