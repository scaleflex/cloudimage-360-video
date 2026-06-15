import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CI360Video } from '../src/core/ci-360-video';

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(el);
  return el;
}

// Let any pending microtasks (PlayerFactory.create resolves, loadedmetadata
// listener registration) settle before assertions.
async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('CI360Video lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('constructs without throwing', () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    expect(p).toBeDefined();
    p.destroy();
  });

  it('adds .ci-360-video class to the container and removes it on destroy', () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    expect(container.classList.contains('ci-360-video')).toBe(true);
    p.destroy();
    expect(container.classList.contains('ci-360-video')).toBe(false);
  });

  it('mounts the canvas after async init and removes it on destroy', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();
    expect(container.querySelector('canvas')).not.toBeNull();
    p.destroy();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('creating a second instance on the same container destroys the first', () => {
    const container = makeContainer();
    const p1 = new CI360Video(container, { src: 'a.mp4' });
    const spy = vi.spyOn(p1, 'destroy');
    const p2 = new CI360Video(container, { src: 'b.mp4' });
    expect(spy).toHaveBeenCalled();
    p2.destroy();
  });

  it('getView() works before async init completes', () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4', initialLon: 30, initialLat: 10, fov: 60 });
    const v = p.getView();
    expect(v.lon).toBe(30);
    expect(v.lat).toBe(10);
    expect(v.fov).toBe(60);
    p.destroy();
  });

  it('setView snap=false (animate) leaves a gap toward the target with damping on', () => {
    const container = makeContainer();
    const p = new CI360Video(container, {
      src: 'a.mp4',
      damping: true,
      dampingFactor: 0.1,
    });
    p.setView({ lon: 90 }, true /* animate */); // public API: animate=true means lerp
    const v = p.getView();
    // No tick has run yet — view should still be at initial 0.
    expect(v.lon).toBe(0);
    p.destroy();
  });

  it('autoLoad=false renders an activate overlay instead of booting WebGL', () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4', autoLoad: false });
    expect(container.querySelector('.ci-360-video-activate')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    p.destroy();
  });

  it('exposes the underlying Three.js objects via getThreeObjects() after init', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();
    const objs = p.getThreeObjects();
    expect(objs).not.toBeNull();
    expect(objs!.scene).toBeDefined();
    expect(objs!.camera).toBeDefined();
    expect(objs!.renderer).toBeDefined();
    p.destroy();
  });

  it('config.sources picks the `default: true` entry as the initial src', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, {
      src: 'fallback.mp4',
      sources: [
        { src: 'low.mp4', label: '480p' },
        { src: 'high.mp4', label: '1080p', default: true },
      ],
    });
    await flushAsync();
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video).not.toBeNull();
    expect(video!.getAttribute('src')).toBe('high.mp4');
    p.destroy();
  });

  it('update() rebuilds the mesh for a runtime projection change', async () => {
    // Regression: update() never rebuilt the mesh, so projection/segments/lensFov
    // changes were silently ignored.
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();
    const video = container.querySelector<HTMLVideoElement>('video')!;
    // jsdom never fires loadedmetadata on its own — force the mesh build.
    Object.defineProperty(video, 'readyState', { value: 1, configurable: true });
    video.dispatchEvent(new Event('loadedmetadata'));

    const before = p.getThreeObjects()!.mesh;
    expect(before).not.toBeNull();
    expect((before!.material as { type: string }).type).toBe('MeshBasicMaterial');

    p.update({ projection: 'fisheye' });
    const after = p.getThreeObjects()!.mesh;
    expect(after).not.toBeNull();
    expect(after).not.toBe(before); // a new mesh was built
    expect((after!.material as { type: string }).type).toBe('ShaderMaterial');
    p.destroy();
  });

  it('update() applies loop and muted to the underlying video at runtime', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, { src: 'a.mp4' });
    await flushAsync();
    const video = container.querySelector<HTMLVideoElement>('video')!;
    p.update({ loop: true });
    expect(video.loop).toBe(true);
    p.update({ muted: true });
    expect(video.muted).toBe(true);
    p.update({ loop: false });
    expect(video.loop).toBe(false);
    p.destroy();
  });

  it('config.sources falls back to the first entry when no `default` is set', async () => {
    const container = makeContainer();
    const p = new CI360Video(container, {
      src: 'fallback.mp4',
      sources: [
        { src: 'a.mp4', label: '480p' },
        { src: 'b.mp4', label: '1080p' },
      ],
    });
    await flushAsync();
    const video = container.querySelector<HTMLVideoElement>('video');
    expect(video!.getAttribute('src')).toBe('a.mp4');
    p.destroy();
  });
});
