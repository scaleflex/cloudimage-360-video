import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared state, hoisted so the vi.mock factories below can close over it.
const counters = vi.hoisted(() => ({
  hlsNew: 0,
  hlsDestroy: 0,
  dashNew: 0,
  dashReset: 0,
  lastHls: null as any,
  lastDash: null as any,
}));

vi.mock('hls.js', () => {
  class FakeHls {
    static isSupported(): boolean {
      return true;
    }
    calls: string[] = [];
    handlers: Record<string, () => void> = {};
    levels: Array<{ height?: number; width?: number; bitrate?: number }> = [];
    // Mirror hls.js: assigning `currentLevel` also pins `manualLevel`; both are
    // -1 in ABR/auto mode.
    _currentLevel = -1;
    manualLevel = -1;
    get currentLevel(): number {
      return this._currentLevel;
    }
    set currentLevel(v: number) {
      this._currentLevel = v;
      this.manualLevel = v;
    }
    constructor() {
      counters.hlsNew++;
      counters.lastHls = this;
    }
    on(evt: string, cb: () => void): void {
      this.calls.push(`on:${evt}`);
      this.handlers[evt] = cb;
    }
    loadSource(): void {
      this.calls.push('loadSource');
    }
    attachMedia(): void {
      this.calls.push('attachMedia');
    }
    destroy(): void {
      counters.hlsDestroy++;
    }
  }
  return { default: FakeHls };
});

vi.mock('dashjs', () => {
  const player = {
    calls: [] as string[],
    handlers: {} as Record<string, () => void>,
    on(evt: string, cb: () => void): void {
      this.calls.push(`on:${evt}`);
      this.handlers[evt] = cb;
    },
    initialize(): void {
      this.calls.push('initialize');
    },
    getBitrateInfoListFor(): unknown[] {
      return [];
    },
    setQualityForCalls: [] as unknown[][],
    updateSettingsCalls: [] as unknown[][],
    setQualityFor(type: string, id: unknown): void {
      this.setQualityForCalls.push([type, id]);
    },
    updateSettings(settings: unknown): void {
      this.updateSettingsCalls.push([settings]);
    },
    reset(): void {
      counters.dashReset++;
    },
  };
  return {
    default: {
      MediaPlayer: () => ({
        create: () => {
          counters.dashNew++;
          counters.lastDash = player;
          player.calls = [];
          player.handlers = {};
          player.setQualityForCalls = [];
          player.updateSettingsCalls = [];
          return player;
        },
      }),
    },
  };
});

import { HLSAdapter } from '../src/player/hls-adapter';
import { DashAdapter } from '../src/player/dash-adapter';

/** Let the dynamic `import(...)` inside the adapter resolve. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  counters.hlsNew = 0;
  counters.hlsDestroy = 0;
  counters.dashNew = 0;
  counters.dashReset = 0;
  counters.lastHls = null;
  counters.lastDash = null;
});

describe('streaming adapter destroy-during-init race', () => {
  it('HLSAdapter: destroy() before import resolves never constructs Hls', async () => {
    const a = new HLSAdapter({ src: 'x.m3u8' });
    a.destroy();
    await flush();
    expect(counters.hlsNew).toBe(0);
  });

  it('HLSAdapter: normal lifecycle constructs then destroys exactly one Hls', async () => {
    const a = new HLSAdapter({ src: 'x.m3u8' });
    await flush();
    expect(counters.hlsNew).toBe(1);
    a.destroy();
    expect(counters.hlsDestroy).toBe(1);
  });

  it('DashAdapter: destroy() before import resolves never creates a MediaPlayer', async () => {
    const a = new DashAdapter({ src: 'x.mpd' });
    a.destroy();
    await flush();
    expect(counters.dashNew).toBe(0);
  });

  it('DashAdapter: normal lifecycle creates then resets exactly one player', async () => {
    const a = new DashAdapter({ src: 'x.mpd' });
    await flush();
    expect(counters.dashNew).toBe(1);
    a.destroy();
    expect(counters.dashReset).toBe(1);
  });
});

describe('streaming adapter level-event wiring (cached-manifest race)', () => {
  it('HLSAdapter subscribes to hlsManifestParsed BEFORE loadSource', async () => {
    new HLSAdapter({ src: 'x.m3u8' });
    await flush();
    const calls: string[] = counters.lastHls.calls;
    const onIdx = calls.indexOf('on:hlsManifestParsed');
    const loadIdx = calls.indexOf('loadSource');
    expect(onIdx).toBeGreaterThanOrEqual(0);
    expect(loadIdx).toBeGreaterThanOrEqual(0);
    // Regression: a manifest served from cache fires MANIFEST_PARSED almost
    // immediately, so the listener must already be attached when load starts.
    expect(onIdx).toBeLessThan(loadIdx);
  });

  it('HLSAdapter prefers hls.js even when the browser reports native HLS support', async () => {
    // Root-cause regression: browsers that report native HLS (Safari, some
    // Chromium builds) must NOT short-circuit to `<video src>` — that path
    // hides the rendition list and leaves the quality menu stuck. hls.js wins
    // whenever it's supported.
    const origCanPlayType = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = () => 'maybe';
    try {
      new HLSAdapter({ src: 'x.m3u8' });
      await flush();
      expect(counters.hlsNew).toBe(1);
      expect(counters.lastHls).not.toBeNull();
    } finally {
      HTMLMediaElement.prototype.canPlayType = origCanPlayType;
    }
  });

  it('HLSAdapter re-emits levels on manifest parse', async () => {
    const a = new HLSAdapter({ src: 'x.m3u8' });
    const onLevels = vi.fn();
    a.on('qualitylevelsupdated', onLevels);
    await flush();
    counters.lastHls.levels = [
      { height: 1080, width: 1920, bitrate: 5_000_000 },
      { height: 720, width: 1280, bitrate: 2_000_000 },
    ];
    counters.lastHls.handlers['hlsManifestParsed']();
    expect(onLevels).toHaveBeenCalled();
    const levels = onLevels.mock.calls.at(-1)![0];
    expect(levels).toHaveLength(2);
    expect(levels[0]).toMatchObject({ id: 0, label: '1080p' });
    expect(levels[1]).toMatchObject({ id: 1, label: '720p' });
  });

  it('HLSAdapter.setQuality ignores a non-numeric (stale cosmetic) id', async () => {
    const a = new HLSAdapter({ src: 'x.m3u8' });
    await flush();
    counters.lastHls.levels = [{ height: 1080 }, { height: 480 }];
    a.setQuality('480p'); // cosmetic string — must NOT touch currentLevel
    expect(counters.lastHls.currentLevel).toBe(-1);
    a.setQuality(1); // valid index
    expect(counters.lastHls.currentLevel).toBe(1);
    a.setQuality('auto'); // back to ABR
    expect(counters.lastHls.currentLevel).toBe(-1);
  });

  it('HLSAdapter.getCurrentQuality reports auto in ABR, index when pinned', async () => {
    const a = new HLSAdapter({ src: 'x.m3u8' });
    await flush();
    counters.lastHls.levels = [{ height: 1080 }, { height: 480 }];
    // Default: manualLevel -1 ⇒ auto (even though a real currentLevel may play).
    counters.lastHls._currentLevel = 0; // ABR is playing level 0 ...
    expect(a.getCurrentQuality()).toBe('auto'); // ... but we report auto
    a.setQuality(1); // pin ⇒ manualLevel 1
    expect(a.getCurrentQuality()).toBe(1);
  });

  it('DashAdapter.setQuality ignores a non-numeric (stale cosmetic) id', async () => {
    const a = new DashAdapter({ src: 'x.mpd' });
    await flush();
    // Cosmetic string id — must NOT forward to dash.js setQualityFor.
    a.setQuality('480p');
    expect(counters.lastDash.setQualityForCalls).toHaveLength(0);
    // Valid numeric index — pins the rendition.
    a.setQuality(1);
    expect(counters.lastDash.setQualityForCalls.at(-1)).toEqual(['video', 1]);
    // 'auto' — re-enables ABR via updateSettings.
    a.setQuality('auto');
    expect(counters.lastDash.updateSettingsCalls.at(-1)![0]).toMatchObject({
      streaming: { abr: { autoSwitchBitrate: { video: true } } },
    });
    a.destroy();
  });

  it('DashAdapter subscribes to streamInitialized BEFORE initialize', async () => {
    new DashAdapter({ src: 'x.mpd' });
    await flush();
    const calls: string[] = counters.lastDash.calls;
    const onIdx = calls.indexOf('on:streamInitialized');
    const initIdx = calls.indexOf('initialize');
    expect(onIdx).toBeGreaterThanOrEqual(0);
    expect(initIdx).toBeGreaterThanOrEqual(0);
    expect(onIdx).toBeLessThan(initIdx);
  });
});
