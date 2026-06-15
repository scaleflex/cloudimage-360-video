import type { PerspectiveCamera } from 'three';
import type { ViewStateManager } from './view-state';
import { addListener } from '../utils/events';

export interface OrbitControls360Options {
  enabled?: boolean;
  dragToRotate?: boolean;
  invertDrag?: boolean;
  /** Multiplier on drag → lon/lat conversion. */
  rotateSpeed?: number;
  scrollToZoom?: boolean;
  /** Degrees of FOV change per `wheel.deltaY` pixel. */
  zoomSpeed?: number;
  autoRotate?: boolean;
  /** Degrees per second applied to lon while idle. */
  autoRotateSpeed?: number;
  /** Milliseconds of input inactivity before auto-rotate resumes. */
  autoRotateIdleDelay?: number;
}

export interface OrbitControls360Handle {
  /** Advance time-based state (auto-rotate). Call once per render-loop tick. */
  update: (dt: number) => void;
  setOptions: (opts: Partial<OrbitControls360Options>) => void;
  destroy: () => void;
}

/**
 * Custom controls for inside-a-sphere viewing.
 *
 * Critical: this is NOT `OrbitControls`. The stock Three.js OrbitControls
 * dollies the camera toward a target when zooming, which would push the
 * camera off the sphere centre and shatter the panorama illusion. Here:
 *   - drag → rotate `lon` / `lat` of the view-state (camera stays at origin)
 *   - wheel / pinch → change `fov` (true visual zoom)
 *   - auto-rotate → drift `lon` while idle
 *
 * Sensitivity scales with current FOV so dragging while zoomed in moves
 * fewer degrees per pixel — feels natural rather than over-sensitive.
 */
export function createOrbitControls360(
  container: HTMLElement,
  camera: PerspectiveCamera,
  view: ViewStateManager,
  initial: OrbitControls360Options = {},
): OrbitControls360Handle {
  const opts: Required<OrbitControls360Options> = {
    enabled: initial.enabled ?? true,
    dragToRotate: initial.dragToRotate ?? true,
    invertDrag: initial.invertDrag ?? false,
    rotateSpeed: initial.rotateSpeed ?? 1.0,
    scrollToZoom: initial.scrollToZoom ?? true,
    zoomSpeed: initial.zoomSpeed ?? 0.05,
    autoRotate: initial.autoRotate ?? false,
    autoRotateSpeed: initial.autoRotateSpeed ?? 10,
    autoRotateIdleDelay: initial.autoRotateIdleDelay ?? 2000,
  };

  let dragging = false;
  let activePointerId: number | null = null;
  let prevX = 0;
  let prevY = 0;
  let lastInputTime = 0;
  const activePointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartFov = 0;

  const markInput = (): void => {
    lastInputTime = performance.now();
  };

  /**
   * Bail out when the event originates inside an interactive UI overlay.
   *
   * Without this guard, our `setPointerCapture(container)` call on `pointerdown`
   * would redirect every subsequent pointer event to the container — silently
   * hijacking native drag of the volume `<input type=range>` and preventing the
   * `click` event from ever reaching toolbar buttons. So if the user pressed
   * down on anything inside the toolbar / loading / error / activate overlay,
   * we leave the event alone for native handling.
   */
  const isPointerOverUI = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      '.ci-360-video-controls, .ci-360-video-loading, .ci-360-video-error, .ci-360-video-activate, .ci-360-video-overlays',
    );
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (!opts.enabled || !opts.dragToRotate) return;
    if (isPointerOverUI(e.target)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      dragging = true;
      activePointerId = e.pointerId;
      prevX = e.clientX;
      prevY = e.clientY;
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture isn't critical — some pointer types refuse it
      }
    } else if (activePointers.size === 2) {
      // Pinch start: suspend rotation drag while two fingers are down.
      dragging = false;
      const [a, b] = [...activePointers.values()];
      pinchStartDist = Math.hypot(b.x - a.x, b.y - a.y);
      pinchStartFov = view.getTargetView().fov;
    }
    markInput();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!opts.enabled) return;
    const tracked = activePointers.get(e.pointerId);
    if (!tracked) return;
    tracked.x = e.clientX;
    tracked.y = e.clientY;

    if (activePointers.size === 2 && pinchStartDist > 0) {
      const [a, b] = [...activePointers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const ratio = dist / pinchStartDist;
      // Spreading fingers (ratio > 1) → zoom in (smaller fov).
      view.setView({ fov: pinchStartFov / ratio });
      markInput();
      return;
    }

    if (!dragging || e.pointerId !== activePointerId) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    prevX = e.clientX;
    prevY = e.clientY;

    const fov = view.getTargetView().fov;
    const sign = opts.invertDrag ? 1 : -1;
    // Px → degrees mapping: one container-height drag rotates by `rotateSpeed × fov` degrees.
    const k = (opts.rotateSpeed * fov) / Math.max(container.clientHeight, 1);
    view.rotateBy(sign * dx * k, -sign * dy * k);
    markInput();
  };

  const onPointerUp = (e: PointerEvent): void => {
    activePointers.delete(e.pointerId);
    if (e.pointerId === activePointerId) {
      dragging = false;
      activePointerId = null;
      try {
        if (container.hasPointerCapture(e.pointerId)) {
          container.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
    if (activePointers.size < 2) pinchStartDist = 0;
    markInput();
  };

  const onWheel = (e: WheelEvent): void => {
    if (!opts.enabled || !opts.scrollToZoom) return;
    // Don't hijack wheel events over the toolbar (so scroll-into-view on a
    // long popup still works) or other UI overlays.
    if (isPointerOverUI(e.target)) return;
    e.preventDefault();
    // deltaY > 0 → scrolling down → zoom out (bigger FOV).
    view.zoomBy(e.deltaY * opts.zoomSpeed);
    markInput();
  };

  const cleanups = [
    addListener(container, 'pointerdown', onPointerDown as EventListener),
    addListener(container, 'pointermove', onPointerMove as EventListener),
    addListener(container, 'pointerup', onPointerUp as EventListener),
    addListener(container, 'pointercancel', onPointerUp as EventListener),
    addListener(container, 'pointerleave', onPointerUp as EventListener),
    addListener(container, 'wheel', onWheel as EventListener, { passive: false }),
  ];

  // `camera` is captured for future use (e.g. switching projection types).
  void camera;

  return {
    update: (dt) => {
      if (!opts.enabled || !opts.autoRotate) return;
      if (performance.now() - lastInputTime < opts.autoRotateIdleDelay) return;
      // Negative deltaLon = clockwise yaw (= "look right") — matches the drag
      // convention where dragging right also produces a negative deltaLon.
      // Pass a negative `autoRotateSpeed` to reverse the direction.
      view.rotateBy(-opts.autoRotateSpeed * dt, 0);
    },
    setOptions: (next) => {
      Object.assign(opts, next);
    },
    destroy: () => {
      cleanups.forEach((fn) => fn());
      activePointers.clear();
      dragging = false;
      activePointerId = null;
    },
  };
}
