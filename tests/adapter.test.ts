import { describe, it, expect, vi } from 'vitest';
import { HTML5Adapter } from '../src/player/html5-adapter';
import {
  PlayerFactory,
  detectPlayerType,
  isHLSUrl,
  isDashUrl,
} from '../src/player/player-factory';

describe('PlayerFactory.detect', () => {
  it('routes .m3u8 URLs to hls', () => {
    expect(detectPlayerType('https://x/y.m3u8')).toBe('hls');
    expect(detectPlayerType('https://x/y.m3u8?token=abc')).toBe('hls');
    expect(isHLSUrl('https://x/y.m3u8')).toBe(true);
  });
  it('routes .mpd URLs to dash', () => {
    expect(detectPlayerType('https://x/y.mpd')).toBe('dash');
    expect(detectPlayerType('https://x/y.mpd?cdn=1')).toBe('dash');
    expect(isDashUrl('https://x/y.mpd')).toBe(true);
  });
  it('routes everything else to html5', () => {
    expect(detectPlayerType('https://x/y.mp4')).toBe('html5');
    expect(detectPlayerType('https://x/y.webm')).toBe('html5');
  });

  it('PlayerFactory.create returns an HTML5Adapter for MP4', async () => {
    const adapter = await PlayerFactory.create({ src: 'https://x/y.mp4' });
    expect(adapter).toBeInstanceOf(HTML5Adapter);
    adapter.destroy();
  });

  it('PlayerFactory.create respects explicit playerType=html5 for m3u8 URLs', async () => {
    const adapter = await PlayerFactory.create({
      src: 'https://x/y.m3u8',
      playerType: 'html5',
    });
    expect(adapter).toBeInstanceOf(HTML5Adapter);
    adapter.destroy();
  });

  it('PlayerFactory.create respects explicit playerType=html5 for .mpd URLs', async () => {
    const adapter = await PlayerFactory.create({
      src: 'https://x/y.mpd',
      playerType: 'html5',
    });
    expect(adapter).toBeInstanceOf(HTML5Adapter);
    adapter.destroy();
  });

  it('PlayerFactory.create returns a DashAdapter for .mpd URLs', async () => {
    const adapter = await PlayerFactory.create({ src: 'https://x/y.mpd' });
    // DashAdapter extends HTML5Adapter — instanceof works through the chain,
    // but we want to be sure it's the dash variant.
    const { DashAdapter } = await import('../src/player/dash-adapter');
    expect(adapter).toBeInstanceOf(DashAdapter);
    adapter.destroy();
  });
});

describe('HTML5Adapter', () => {
  it('creates a <video> with playsinline + preload="auto"', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    const v = a.getVideoElement();
    expect(v.tagName).toBe('VIDEO');
    expect(v.hasAttribute('playsinline')).toBe(true);
    expect(v.preload).toBe('auto');
    a.destroy();
  });

  it('autoplay implies muted (browser policy)', () => {
    const a = new HTML5Adapter({ src: 'a.mp4', autoplay: true });
    const v = a.getVideoElement();
    expect(v.muted).toBe(true);
    a.destroy();
  });

  it('re-emits media events via the EventEmitter API', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    const v = a.getVideoElement();
    const onPlay = vi.fn();
    a.on('play', onPlay);
    v.dispatchEvent(new Event('play'));
    expect(onPlay).toHaveBeenCalled();
    a.destroy();
  });

  it('mount attaches the video to the host container', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    const container = document.createElement('div');
    a.mount(container);
    expect(container.querySelector('video')).toBe(a.getVideoElement());
    a.destroy();
  });

  it('destroy detaches the video and stops emitting', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    const container = document.createElement('div');
    a.mount(container);
    const onPlay = vi.fn();
    a.on('play', onPlay);
    a.destroy();
    expect(container.querySelector('video')).toBeNull();
    // After destroy the EventEmitter has been cleared; emitting now does nothing.
    a.emit('play');
    expect(onPlay).not.toHaveBeenCalled();
  });
});
