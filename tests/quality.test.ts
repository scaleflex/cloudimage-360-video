import { describe, it, expect, vi } from 'vitest';
import { HTML5Adapter } from '../src/player/html5-adapter';
import { HLSAdapter } from '../src/player/hls-adapter';

describe('quality API — HTML5 defaults', () => {
  it('returns empty level list and "auto" as current', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    expect(a.getAvailableQualities()).toEqual([]);
    expect(a.getCurrentQuality()).toBe('auto');
    a.destroy();
  });
  it('setQuality is a no-op (does not throw)', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    expect(() => a.setQuality(0)).not.toThrow();
    expect(() => a.setQuality('auto')).not.toThrow();
    a.destroy();
  });
});

describe('HTML5 adapter — error event payload', () => {
  // Regression: the adapter used to re-emit the <video> element as the error
  // arg, so consumers' onError received a DOM node and the core's
  // `err instanceof Error` check fell back to a generic message.
  it('emits a real Error built from MediaError, not the <video> element', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    const v = a.getVideoElement();
    Object.defineProperty(v, 'error', {
      configurable: true,
      value: { code: 4, message: 'boom' },
    });
    let received: unknown;
    a.on('error', (e: unknown) => { received = e; });
    v.dispatchEvent(new Event('error'));
    expect(received).toBeInstanceOf(Error);
    expect((received as Error).message).toContain('MEDIA_ERR_SRC_NOT_SUPPORTED');
    expect((received as Error).message).toContain('boom');
    a.destroy();
  });
  it('falls back to a generic Error when MediaError is absent', () => {
    const a = new HTML5Adapter({ src: 'a.mp4' });
    let received: unknown;
    a.on('error', (e: unknown) => { received = e; });
    a.getVideoElement().dispatchEvent(new Event('error'));
    expect(received).toBeInstanceOf(Error);
    a.destroy();
  });
});

describe('quality API — HLS adapter mapping', () => {
  /** Stub an `hls.js` instance with the surface our adapter touches. */
  function makeHlsStub(levels: any[]): any {
    return {
      levels,
      currentLevel: -1,
      // -1 in ABR/auto mode; set to a level index when a quality is pinned.
      manualLevel: -1,
      loadSource: vi.fn(),
      attachMedia: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
    };
  }

  it('maps hls.levels to QualityLevel[]', () => {
    const a = new HLSAdapter({ src: 'a.m3u8' });
    // Bypass the dynamic-import path by injecting our stub directly.
    (a as any).hls = makeHlsStub([
      { width: 1920, height: 1080, bitrate: 5_000_000 },
      { width: 1280, height: 720, bitrate: 2_500_000 },
      { width: 854, height: 480, bitrate: 1_000_000 },
    ]);
    const qs = a.getAvailableQualities();
    expect(qs).toHaveLength(3);
    expect(qs[0]).toMatchObject({ id: 0, label: '1080p', width: 1920, height: 1080 });
    expect(qs[1].label).toBe('720p');
    expect(qs[2].label).toBe('480p');
    a.destroy();
  });

  it('getCurrentQuality returns "auto" when hls.currentLevel === -1', () => {
    const a = new HLSAdapter({ src: 'a.m3u8' });
    (a as any).hls = makeHlsStub([{ height: 720, bitrate: 2_500_000 }]);
    expect(a.getCurrentQuality()).toBe('auto');
    a.destroy();
  });

  it('getCurrentQuality returns the index when a level is pinned (manualLevel)', () => {
    const a = new HLSAdapter({ src: 'a.m3u8' });
    const stub = makeHlsStub([{ height: 720 }, { height: 480 }]);
    // Pinning a level sets manualLevel; currentLevel may differ (it tracks the
    // level actually playing), so getCurrentQuality must read manualLevel.
    stub.manualLevel = 1;
    stub.currentLevel = 0;
    (a as any).hls = stub;
    expect(a.getCurrentQuality()).toBe(1);
    a.destroy();
  });

  it('setQuality(id) maps "auto" to -1, numbers to themselves', () => {
    const a = new HLSAdapter({ src: 'a.m3u8' });
    const stub = makeHlsStub([{ height: 720 }, { height: 480 }]);
    (a as any).hls = stub;
    a.setQuality(1);
    expect(stub.currentLevel).toBe(1);
    a.setQuality('auto');
    expect(stub.currentLevel).toBe(-1);
    a.destroy();
  });

  it('returns empty list when hls is not initialised', () => {
    const a = new HLSAdapter({ src: 'a.m3u8' });
    // `this.hls` is null until `initHLS` resolves — base behaviour should still be safe.
    expect(a.getAvailableQualities()).toEqual([]);
    expect(a.getCurrentQuality()).toBe('auto');
    a.destroy();
  });
});
