import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CI360Video } from '../src/core/ci-360-video';
import { Toolbar } from '../src/ui/toolbar';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(el);
  return el;
}

async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('cardboard (split-screen) VR view', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts off, and setVRView toggles state + container class', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4', vrButton: true });
    await flushAsync();

    expect(p.isVRView()).toBe(false);
    expect(container.classList.contains('ci-360-video--cardboard')).toBe(false);

    p.setVRView(true);
    expect(p.isVRView()).toBe(true);
    expect(container.classList.contains('ci-360-video--cardboard')).toBe(true);

    p.setVRView(false);
    expect(p.isVRView()).toBe(false);
    expect(container.classList.contains('ci-360-video--cardboard')).toBe(false);

    p.destroy();
  });

  it('setVRView() with no argument flips the current state', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();

    p.setVRView();
    expect(p.isVRView()).toBe(true);
    p.setVRView();
    expect(p.isVRView()).toBe(false);

    p.destroy();
  });

  it('idempotent: toggling to the same state is a no-op', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();

    p.setVRView(true);
    p.setVRView(true);
    expect(p.isVRView()).toBe(true);
    p.destroy();
  });

  it('destroy() while in VR view clears the cardboard class (no stale seam on reuse)', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();

    p.setVRView(true);
    expect(container.classList.contains('ci-360-video--cardboard')).toBe(true);

    p.destroy();
    expect(container.classList.contains('ci-360-video--cardboard')).toBe(false);

    // A fresh instance on the same container must not inherit the seam.
    const p2 = new CI360Video(container, { src: 'b.mp4' });
    await flushAsync();
    expect(container.classList.contains('ci-360-video--cardboard')).toBe(false);
    p2.destroy();
  });

  it('setVRView(true) before async init does not throw and survives init', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4', gyroscope: true });
    // Toggle before init()'s async adapter creation settles.
    p.setVRView(true);
    expect(p.isVRView()).toBe(true);
    await flushAsync();
    expect(p.isVRView()).toBe(true);
    p.destroy();
  });
});

// ---- toolbar VR button ------------------------------------------------------

function makeVrToolbar() {
  const onEnterVR = vi.fn();
  const toolbar = new Toolbar({
    fullscreenButton: true,
    vrButton: true,
    onPlayPause: vi.fn(),
    onMuteToggle: vi.fn(),
    onVolumeChange: vi.fn(),
    onSeek: vi.fn(),
    onSpeedChange: vi.fn(),
    onQualityChange: vi.fn(),
    onLoopToggle: vi.fn(),
    onFullscreen: vi.fn(),
    onEnterVR,
  });
  document.body.appendChild(toolbar.element);
  return { toolbar, onEnterVR };
}

describe('Toolbar VR button', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders only when vrButton is set and fires onEnterVR on click', () => {
    const { toolbar, onEnterVR } = makeVrToolbar();
    const btn = toolbar.element.querySelector<HTMLButtonElement>('.ci-360-video-controls-vr-btn');
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onEnterVR).toHaveBeenCalledTimes(1);
  });

  it('setVrActive reflects pressed state and label', () => {
    const { toolbar } = makeVrToolbar();
    const btn = toolbar.element.querySelector<HTMLButtonElement>('.ci-360-video-controls-vr-btn')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');

    toolbar.setVrActive(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(btn.classList.contains('ci-360-video-controls-vr-btn--active')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Exit VR view');

    toolbar.setVrActive(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.classList.contains('ci-360-video-controls-vr-btn--active')).toBe(false);
  });
});
