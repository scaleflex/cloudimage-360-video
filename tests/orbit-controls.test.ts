import { describe, it, expect, beforeEach } from 'vitest';
import { PerspectiveCamera } from 'three';
import { createOrbitControls360 } from '../src/controls/orbit-controls-360';
import { ViewStateManager } from '../src/controls/view-state';

function makeView(): ViewStateManager {
  return new ViewStateManager({
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
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(el);
  return el;
}

describe('orbit-controls-360 — pointer hijack guard (regression)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('skips pointerdown that originates inside the toolbar', () => {
    const container = makeContainer();
    const camera = new PerspectiveCamera(75, 4 / 3, 0.1, 1100);
    const view = makeView();
    const controls = createOrbitControls360(container, camera, view, {
      enabled: true,
      dragToRotate: true,
      rotateSpeed: 1,
    });

    // Mount a fake toolbar inside the container.
    const toolbar = document.createElement('div');
    toolbar.className = 'ci-360-video-controls';
    const slider = document.createElement('input');
    slider.type = 'range';
    toolbar.appendChild(slider);
    container.appendChild(toolbar);

    // PointerEvent isn't in jsdom; synthesize one by extending MouseEvent with pointerId.
    const dispatch = (type: string, target: Element, x: number, y: number): void => {
      const ev = new MouseEvent(type, {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(ev, 'pointerId', { value: 1, configurable: true });
      target.dispatchEvent(ev);
    };
    dispatch('pointerdown', slider, 100, 300);
    dispatch('pointermove', slider, 300, 300);
    dispatch('pointerup', slider, 300, 300);

    expect(view.getTargetView().lon).toBe(0);
    expect(view.getTargetView().lat).toBe(0);
    controls.destroy();
  });

  it('still rotates when pointerdown originates inside the container (not toolbar)', () => {
    const container = makeContainer();
    const camera = new PerspectiveCamera(75, 4 / 3, 0.1, 1100);
    const view = makeView();
    const controls = createOrbitControls360(container, camera, view, {
      enabled: true,
      dragToRotate: true,
      rotateSpeed: 1,
    });

    const dispatch = (type: string, target: Element, x: number, y: number): void => {
      const ev = new MouseEvent(type, {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(ev, 'pointerId', { value: 2, configurable: true });
      target.dispatchEvent(ev);
    };
    dispatch('pointerdown', container, 100, 300);
    dispatch('pointermove', container, 200, 300);
    dispatch('pointerup', container, 200, 300);

    // dx = 100, height = 600, rotateSpeed = 1, fov = 75 → deltaLon = -100 × 1 × 75/600 = -12.5
    expect(view.getTargetView().lon).toBeCloseTo(-12.5, 1);
    controls.destroy();
  });

  it('after a pinch, lifting the first finger lets the remaining finger drag', () => {
    // Regression: activePointerId wasn't re-promoted, so the remaining finger
    // couldn't pan until the user lifted and re-touched.
    const container = makeContainer();
    const camera = new PerspectiveCamera(75, 4 / 3, 0.1, 1100);
    const view = makeView();
    const controls = createOrbitControls360(container, camera, view, {
      enabled: true,
      dragToRotate: true,
      rotateSpeed: 1,
    });
    const dispatch = (type: string, id: number, x: number, y: number): void => {
      const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'pointerId', { value: id, configurable: true });
      container.dispatchEvent(ev);
    };
    dispatch('pointerdown', 1, 100, 300); // finger A → drag
    dispatch('pointerdown', 2, 200, 300); // finger B → pinch (drag suspended)
    dispatch('pointerup', 1, 100, 300); // lift A — B should be promoted to drag
    const lonBefore = view.getTargetView().lon;
    dispatch('pointermove', 2, 300, 300); // drag with B: dx = 100
    expect(view.getTargetView().lon).not.toBe(lonBefore);
    controls.destroy();
  });

  it('keeps pinch-zoom alive when a third finger touches (no freeze)', () => {
    // Regression: a third pointer made size !== 2, freezing the zoom branch.
    const container = makeContainer();
    const camera = new PerspectiveCamera(75, 4 / 3, 0.1, 1100);
    const view = makeView();
    const controls = createOrbitControls360(container, camera, view, {
      enabled: true,
      dragToRotate: true,
    });
    const dispatch = (type: string, id: number, x: number, y: number): void => {
      const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'pointerId', { value: id, configurable: true });
      container.dispatchEvent(ev);
    };
    dispatch('pointerdown', 1, 300, 300);
    dispatch('pointerdown', 2, 500, 300); // pinch baseline dist = 200
    const fov0 = view.getTargetView().fov;
    dispatch('pointerdown', 3, 400, 500); // third finger → baseline recaptured
    dispatch('pointermove', 2, 700, 300); // first pair now 400 apart → ratio 2
    expect(view.getTargetView().fov).not.toBe(fov0);
    controls.destroy();
  });

  it('skips wheel events that originate inside the toolbar', () => {
    const container = makeContainer();
    const camera = new PerspectiveCamera(75, 4 / 3, 0.1, 1100);
    const view = makeView();
    const controls = createOrbitControls360(container, camera, view, {
      enabled: true,
      scrollToZoom: true,
      zoomSpeed: 1,
    });

    const toolbar = document.createElement('div');
    toolbar.className = 'ci-360-video-controls';
    container.appendChild(toolbar);

    const startFov = view.getTargetView().fov;
    const ev = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    toolbar.dispatchEvent(ev);
    expect(view.getTargetView().fov).toBe(startFov);
    controls.destroy();
  });
});
