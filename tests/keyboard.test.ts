import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ViewStateManager } from '../src/controls/view-state';
import { setupKeyboard } from '../src/a11y/keyboard';

function makeView(): ViewStateManager {
  return new ViewStateManager({
    initialLon: 0, initialLat: 0, initialFov: 75,
    fovMin: 30, fovMax: 100, latMin: -85, latMax: 85,
    damping: false, dampingFactor: 0.1,
  });
}

describe('keyboard handler', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.tabIndex = 0;
    document.body.appendChild(container);
    container.focus();
  });

  it('ArrowLeft / ArrowRight rotate longitude', () => {
    const view = makeView();
    const h = setupKeyboard({ container, view, rotateStepDeg: 5 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(view.getTargetView().lon).toBeCloseTo(5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(view.getTargetView().lon).toBeCloseTo(0);
    h.destroy();
  });

  it('ArrowUp / ArrowDown rotate latitude', () => {
    const view = makeView();
    const h = setupKeyboard({ container, view, rotateStepDeg: 5 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(view.getTargetView().lat).toBeCloseTo(5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(view.getTargetView().lat).toBeCloseTo(0);
    h.destroy();
  });

  it('+ / - change fov (zoom)', () => {
    const view = makeView();
    const h = setupKeyboard({ container, view, fovStepDeg: 5 });
    const startFov = view.getTargetView().fov;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    expect(view.getTargetView().fov).toBeCloseTo(startFov - 5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }));
    expect(view.getTargetView().fov).toBeCloseTo(startFov);
    h.destroy();
  });

  it('Space invokes onPlayPause', () => {
    const view = makeView();
    const onPlayPause = vi.fn();
    const h = setupKeyboard({ container, view, onPlayPause });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onPlayPause).toHaveBeenCalledTimes(1);
    h.destroy();
  });

  it('ignores keys when focus is outside the container', () => {
    const view = makeView();
    const onPlayPause = vi.fn();
    const h = setupKeyboard({ container, view, onPlayPause });
    // Move focus out
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onPlayPause).not.toHaveBeenCalled();
    h.destroy();
  });

  it('destroy() unsubscribes', () => {
    const view = makeView();
    const onPlayPause = vi.fn();
    const h = setupKeyboard({ container, view, onPlayPause });
    h.destroy();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onPlayPause).not.toHaveBeenCalled();
  });
});
