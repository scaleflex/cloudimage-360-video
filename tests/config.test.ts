import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  mergeConfig,
  parseDataAttributes,
  validateConfig,
} from '../src/core/config';

describe('config', () => {
  describe('mergeConfig', () => {
    it('fills in defaults', () => {
      const cfg = mergeConfig({ src: 'foo.mp4' });
      expect(cfg.src).toBe('foo.mp4');
      expect(cfg.fov).toBe(DEFAULT_CONFIG.fov);
      expect(cfg.controls).toBe(true);
      expect(cfg.projection).toBe('equirectangular');
    });
    it('user values win over defaults', () => {
      const cfg = mergeConfig({ src: 'a', fov: 60, autoplay: true });
      expect(cfg.fov).toBe(60);
      expect(cfg.autoplay).toBe(true);
    });
    it('undefined values are skipped (do not clobber defaults)', () => {
      const cfg = mergeConfig({ src: 'a', fov: undefined });
      expect(cfg.fov).toBe(DEFAULT_CONFIG.fov);
    });
  });

  describe('parseDataAttributes', () => {
    it('reads booleans, numbers, strings from data-ci-360-video-* attrs', () => {
      const el = document.createElement('div');
      el.setAttribute('data-ci-360-video-src', 'video.mp4');
      el.setAttribute('data-ci-360-video-autoplay', 'true');
      el.setAttribute('data-ci-360-video-fov', '50');
      el.setAttribute('data-ci-360-video-controls', '');
      const parsed = parseDataAttributes(el);
      expect(parsed.src).toBe('video.mp4');
      expect(parsed.autoplay).toBe(true);
      expect(parsed.fov).toBe(50);
      expect(parsed.controls).toBe(true);
    });
    it('ignores unknown attributes', () => {
      const el = document.createElement('div');
      el.setAttribute('data-ci-360-video-nonsense', 'x');
      const parsed = parseDataAttributes(el);
      expect(Object.keys(parsed)).toHaveLength(0);
    });
  });

  describe('validateConfig', () => {
    it('flags missing src when autoLoad is not explicitly false', () => {
      const errs = validateConfig(mergeConfig({ src: '' }));
      expect(errs).toContain('config.src is required');
    });
    it('does not flag missing src when autoLoad is false', () => {
      const errs = validateConfig(mergeConfig({ src: '', autoLoad: false }));
      expect(errs.some((e) => e.includes('src is required'))).toBe(false);
    });
    it('does not flag missing src when a non-empty sources array is given', () => {
      const errs = validateConfig(
        mergeConfig({ src: '', sources: [{ src: 'a.mp4', label: '1080p' }] }),
      );
      expect(errs.some((e) => e.includes('src is required'))).toBe(false);
    });
    it('still flags missing src when sources is empty', () => {
      const errs = validateConfig(mergeConfig({ src: '', sources: [] }));
      expect(errs).toContain('config.src is required');
    });
    it('rejects fov outside (0, 180)', () => {
      expect(validateConfig(mergeConfig({ src: 'a', fov: 0 })).length).toBeGreaterThan(0);
      expect(validateConfig(mergeConfig({ src: 'a', fov: 180 })).length).toBeGreaterThan(0);
    });
    it('rejects fovMin > fovMax', () => {
      const errs = validateConfig(mergeConfig({ src: 'a', fovMin: 90, fovMax: 60 }));
      expect(errs.some((e) => e.includes('fovMin'))).toBe(true);
    });
    it('rejects unsupported projection / stereo', () => {
      const errs1 = validateConfig(mergeConfig({ src: 'a', projection: 'cubemap' as any }));
      expect(errs1.some((e) => e.includes('projection'))).toBe(true);
      const errs2 = validateConfig(mergeConfig({ src: 'a', stereo: 'crossed' as any }));
      expect(errs2.some((e) => e.includes('stereo'))).toBe(true);
    });

    it('accepts the supported stereo layouts', () => {
      for (const layout of ['mono', 'top-bottom', 'side-by-side'] as const) {
        const errs = validateConfig(mergeConfig({ src: 'a', stereo: layout }));
        expect(errs.some((e) => e.includes('stereo'))).toBe(false);
      }
    });
  });
});
