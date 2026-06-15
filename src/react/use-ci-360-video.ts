import { useEffect, useRef, useState } from 'react';
import type { CI360VideoInstance } from '../core/types';
import type { UseCI360VideoOptions, UseCI360VideoReturn } from './types';

/**
 * React hook that mounts a `CI360Video` instance onto a div ref.
 *
 * Why dynamic import of the core: the core touches `window`/`document` and
 * pulls in Three.js — both blow up under Next.js / Remix SSR. Loading the
 * core only inside `useEffect` keeps the React wrapper safe to import from
 * server components.
 *
 * Re-init policy: `src` change destroys & recreates the instance. Everything
 * else (theme, view limits, controls toggles) is forwarded via `update()`
 * without a full rebuild.
 */
export function useCI360Video(options: UseCI360VideoOptions): UseCI360VideoReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instance = useRef<CI360VideoInstance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    setReady(false);

    // Import the core from the package specifier (not a relative path) so the
    // React bundle stays a thin wrapper: the build externalizes
    // `@cloudimage/360-video`, and at runtime Node's package self-reference
    // resolves it to the single installed core — no duplicate copy shipped.
    import('@cloudimage/360-video').then(({ CI360Video }) => {
      if (destroyed || !containerRef.current) return;
      const init = (): void => {
        if (destroyed || !containerRef.current) return;
        // Strip wrapper-only fields before passing to the core.
        const { className: _cn, style: _st, ...config } = optionsRef.current;
        void _cn;
        void _st;
        instance.current = new CI360Video(containerRef.current, config);
        setReady(true);
      };

      // Defer initialization if the container isn't yet attached
      // (e.g. inside a Dialog portal that hasn't mounted).
      if (containerRef.current.isConnected) init();
      else requestAnimationFrame(init);
    });

    return () => {
      destroyed = true;
      instance.current?.destroy();
      instance.current = null;
      setReady(false);
    };
    // Re-init only on src change — other props go through `update()` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.src]);

  // Forward live-updatable props without a full re-init.
  useEffect(() => {
    if (!instance.current) return;
    const { src: _src, className: _cn, style: _st, ...updatable } = optionsRef.current;
    void _src;
    void _cn;
    void _st;
    instance.current.update(updatable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.autoRotate, options.autoRotateSpeed,
    options.controls, options.dragToRotate, options.invertDrag,
    options.rotateSpeed, options.scrollToZoom, options.gyroscope,
    options.damping, options.dampingFactor,
    options.theme, options.fov, options.fovMin, options.fovMax,
    options.latMin, options.latMax,
    options.stereo, // runtime-mutable: core update() re-crops / re-probes
  ]);

  return { containerRef, instance, ready };
}
