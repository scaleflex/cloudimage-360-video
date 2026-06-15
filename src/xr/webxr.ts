import type { WebGLRenderer } from 'three';
import { hasWebXR } from '../utils/capabilities';

export interface XRControllerOptions {
  renderer: WebGLRenderer;
}

export interface XRController {
  /** Probe whether the device + browser support an immersive VR session. */
  isAvailable(): Promise<boolean>;
  enterVR(): Promise<void>;
  exitVR(): Promise<void>;
  isPresenting(): boolean;
}

/**
 * WebXR seam.
 *
 * v1 does NOT ship VR — calling `enterVR()` logs a warning and resolves
 * without doing anything. The seam exists so that promoting VR later is a
 * targeted edit to this file, not a refactor of the engine:
 *
 *   1. Set `renderer.xr.enabled = true`.
 *   2. `const session = await navigator.xr.requestSession('immersive-vr', …)`.
 *   3. `await renderer.xr.setSession(session)`.
 *
 * The render loop already runs on `setAnimationLoop`, which is the only
 * frame source delivered inside an XR session — so the engine doesn't have
 * to change loops when VR is added.
 */
export function createXRController(opts: XRControllerOptions): XRController {
  return {
    async isAvailable() {
      if (!hasWebXR()) return false;
      try {
        const xr = (navigator as any).xr;
        return !!(await xr.isSessionSupported?.('immersive-vr'));
      } catch {
        return false;
      }
    },

    async enterVR() {
      console.warn(
        'CI360Video: VR mode is not implemented in v1. ' +
          'The render loop already uses renderer.setAnimationLoop, so adding VR ' +
          'later is a localized change in xr/webxr.ts.',
      );
    },

    async exitVR() {
      // No-op in v1 — kept for API symmetry with the future implementation.
    },

    isPresenting() {
      return !!(opts.renderer as any).xr?.isPresenting;
    },
  };
}
