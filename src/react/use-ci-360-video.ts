import { useEffect, useRef, useState } from 'react';
import type { CI360VideoConfig, CI360VideoInstance } from '../core/types';
import type { UseCI360VideoOptions, UseCI360VideoReturn } from './types';

/** The slice of the `<ci-360-video>` element this hook drives. Kept local so
 *  the emitted React declarations don't reference the web-component module. */
type CI360VideoElement = HTMLElement & {
  config: Partial<CI360VideoConfig>;
  readonly instance: CI360VideoInstance | null;
  update: (config: Partial<CI360VideoConfig>) => void;
};

/**
 * React hook that mounts the `<ci-360-video>` custom element onto a div ref.
 *
 * Full migration: the wrapper drives the Web Component (which owns the engine),
 * not the class directly. `instance` still exposes the underlying engine so the
 * imperative ref keeps the same API.
 *
 * Why dynamic import of `/define`: it registers the element and pulls in
 * Three.js + `window`/`document` — all SSR-unsafe. Importing it only inside
 * `useEffect` keeps the React entry safe to import from server components.
 *
 * Re-init policy: `src` change recreates the element. Everything else (theme,
 * view limits, controls toggles) is forwarded via `update()` without a rebuild.
 */
export function useCI360Video(options: UseCI360VideoOptions): UseCI360VideoReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const element = useRef<CI360VideoElement | null>(null);
  const instance = useRef<CI360VideoInstance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;
    setReady(false);

    // Import from the package specifier (not a relative path): the React build
    // externalizes `@cloudimage/360-video`, so Node's package self-reference
    // resolves `/define` to the single installed copy — no duplicate shipped.
    import('@cloudimage/360-video/define').then(() => {
      if (destroyed || !containerRef.current) return;
      const init = (): void => {
        if (destroyed || !containerRef.current) return;
        const { className: _cn, style: _st, ...config } = optionsRef.current;
        void _cn;
        void _st;
        const el = document.createElement('ci-360-video') as CI360VideoElement;
        el.style.cssText = 'display:block;width:100%;height:100%';
        // Pass all config (incl. callbacks / sources) as a property, then
        // attach — connectedCallback boots the engine from it synchronously.
        el.config = config;
        containerRef.current.appendChild(el);
        element.current = el;
        instance.current = el.instance;
        setReady(true);
      };

      // Defer if the container isn't attached yet (e.g. a Dialog portal).
      if (containerRef.current.isConnected) init();
      else requestAnimationFrame(init);
    });

    return () => {
      destroyed = true;
      element.current?.remove(); // disconnectedCallback destroys the engine
      element.current = null;
      instance.current = null;
      setReady(false);
    };
    // Re-init only on src change — other props go through `update()` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.src]);

  // Forward live-updatable props without a full re-init.
  useEffect(() => {
    if (!element.current) return;
    const { src: _src, className: _cn, style: _st, ...updatable } = optionsRef.current;
    void _src;
    void _cn;
    void _st;
    element.current.update(updatable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.autoRotate, options.autoRotateSpeed,
    options.controls, options.dragToRotate, options.invertDrag,
    options.rotateSpeed, options.scrollToZoom, options.gyroscope,
    options.damping, options.dampingFactor,
    options.theme, options.fov, options.fovMin, options.fovMax,
    options.latMin, options.latMax,
    options.stereo, // runtime-mutable: core update() re-crops / re-probes
    // Runtime-mutable too: core update() applies these (mesh rebuild / <video>).
    options.projection, options.sphereSegments, options.lensFovDeg,
    options.loop, options.muted,
  ]);

  return { containerRef, instance, ready };
}
