import { describe, it, expect } from 'vitest';
import { checkVideoFitsGpu } from '../src/utils/capabilities';

function makeVideo(width: number, height: number): HTMLVideoElement {
  const v = document.createElement('video');
  Object.defineProperty(v, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(v, 'videoHeight', { value: height, configurable: true });
  return v;
}

describe('checkVideoFitsGpu', () => {
  it('returns fits=true when both dimensions are within the limit', () => {
    const v = makeVideo(4096, 2048);
    const r = checkVideoFitsGpu(v, 8192);
    expect(r.fits).toBe(true);
    expect(r.videoW).toBe(4096);
    expect(r.videoH).toBe(2048);
    expect(r.max).toBe(8192);
  });

  it('returns fits=false when width exceeds the limit', () => {
    const v = makeVideo(8192, 4096);
    const r = checkVideoFitsGpu(v, 4096);
    expect(r.fits).toBe(false);
  });

  it('returns fits=false when height exceeds the limit', () => {
    const v = makeVideo(2048, 8192);
    const r = checkVideoFitsGpu(v, 4096);
    expect(r.fits).toBe(false);
  });

  it('returns fits=true at exactly the boundary', () => {
    const v = makeVideo(4096, 4096);
    const r = checkVideoFitsGpu(v, 4096);
    expect(r.fits).toBe(true);
  });

  it('returns fits=false when max is 0 (unknown / failed query)', () => {
    const v = makeVideo(1920, 1080);
    const r = checkVideoFitsGpu(v, 0);
    expect(r.fits).toBe(false);
    expect(r.max).toBe(0);
  });

  it('handles videos that have not yet emitted metadata (videoWidth=0)', () => {
    const v = makeVideo(0, 0);
    const r = checkVideoFitsGpu(v, 4096);
    expect(r.videoW).toBe(0);
    // Strictly speaking 0 ≤ 4096, so fits=true — caller is expected to check
    // `videoW > 0` before surfacing the message.
    expect(r.fits).toBe(true);
  });
});
