import type { WebGLRenderer } from 'three';

export interface RenderLoopHandle {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

/**
 * Render-loop manager built on `renderer.setAnimationLoop`.
 *
 * Why setAnimationLoop and not requestAnimationFrame:
 *   - It's the only loop API that delivers frames inside a WebXR session.
 *     v1 doesn't ship VR mode, but flipping `renderer.xr.enabled = true`
 *     later "just works" because the loop is already on the right hook.
 *   - `renderer.setAnimationLoop(null)` cleanly stops the loop; with rAF you
 *     have to track and cancel the id yourself.
 *
 * Delta time is clamped to 100 ms so a stalled tab (where `time` jumps by
 * seconds on resume) doesn't produce a single huge `dt` that breaks damping.
 */
export function createRenderLoop(
  renderer: WebGLRenderer,
  tick: (deltaSeconds: number) => void,
): RenderLoopHandle {
  let running = false;
  let lastTime = 0;

  const cb = (time: number): void => {
    if (!running) return;
    const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    try {
      tick(dt);
    } catch (err) {
      console.error('CI360Video: tick threw, stopping loop:', err);
      running = false;
      renderer.setAnimationLoop(null);
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      lastTime = 0;
      renderer.setAnimationLoop(cb);
    },
    stop: () => {
      if (!running) return;
      running = false;
      renderer.setAnimationLoop(null);
    },
    isRunning: () => running,
  };
}
