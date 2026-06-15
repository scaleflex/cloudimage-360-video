import { addListener } from '../utils/events';

export interface FullscreenControllerOptions {
  /** Element to make fullscreen — typically the player container. */
  target: HTMLElement;
  onChange?: (isFullscreen: boolean) => void;
}

export interface FullscreenController {
  enter(): void;
  exit(): void;
  toggle(): void;
  isFullscreen(): boolean;
  isAvailable(): boolean;
  destroy(): void;
}

/**
 * Cross-browser fullscreen wrapper.
 *
 * Safari's `webkit*` variants still ship in iOS/macOS so we listen for both
 * `fullscreenchange` and `webkitfullscreenchange`. Promise-returning fullscreen
 * calls are wrapped with `.catch()` because the browser rejects when the call
 * doesn't originate from a user gesture — surfacing that error to the console
 * doesn't help the user and pollutes logs.
 */
export function createFullscreenController(
  opts: FullscreenControllerOptions,
): FullscreenController {
  const { target, onChange } = opts;
  const doc = document as any;

  const isFs = (): boolean =>
    !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);

  const isAvailable = (): boolean =>
    !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);

  const cleanups = [
    addListener(document, 'fullscreenchange', () => onChange?.(isFs())),
    addListener(document, 'webkitfullscreenchange', () => onChange?.(isFs())),
    // `isFs()`/`exit()` already read the ms-prefixed API; bind its change event
    // too so state stays in sync on browsers that only fire the prefixed one.
    addListener(document, 'MSFullscreenChange', () => onChange?.(isFs())),
  ];

  const enter = (): void => {
    if (isFs()) return;
    const el = target as any;
    const fn = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
    if (!fn) return;
    try {
      const p = fn.call(el);
      if (p && typeof p.catch === 'function') p.catch(() => { /* ignore */ });
    } catch {
      /* ignore */
    }
  };

  const exit = (): void => {
    if (!isFs()) return;
    const fn = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen;
    if (!fn) return;
    try {
      const p = fn.call(doc);
      if (p && typeof p.catch === 'function') p.catch(() => { /* ignore */ });
    } catch {
      /* ignore */
    }
  };

  return {
    enter,
    exit,
    toggle: () => (isFs() ? exit() : enter()),
    isFullscreen: isFs,
    isAvailable,
    destroy: () => cleanups.forEach((fn) => fn()),
  };
}
