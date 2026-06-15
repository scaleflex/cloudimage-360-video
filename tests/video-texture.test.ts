import { describe, it, expect } from 'vitest';
import { createVideoTexture } from '../src/texture/video-texture';

describe('createVideoTexture', () => {
  it('applies anisotropic filtering when a max is provided', () => {
    const video = document.createElement('video');
    const handle = createVideoTexture(video, 16);
    expect(handle.texture.anisotropy).toBe(16);
    handle.destroy();
  });

  it('leaves anisotropy at the Three.js default (1) when none/<=1 is provided', () => {
    const video = document.createElement('video');
    const a = createVideoTexture(video);
    expect(a.texture.anisotropy).toBe(1);
    a.destroy();

    const b = createVideoTexture(video, 1);
    expect(b.texture.anisotropy).toBe(1);
    b.destroy();
  });
});
