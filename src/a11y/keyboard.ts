import type { ViewStateManager } from '../controls/view-state';
import { addListener } from '../utils/events';

export interface KeyboardHandlerOptions {
  container: HTMLElement;
  view: ViewStateManager;
  /** Degrees of yaw/pitch per arrow-key press. */
  rotateStepDeg?: number;
  /** Degrees of FOV change per +/- press. */
  fovStepDeg?: number;
  onPlayPause?: () => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
  onResetView?: () => void;
}

export interface KeyboardHandler {
  destroy(): void;
}

/**
 * Player keybindings.
 *
 *   Arrow keys       → rotate view (lon/lat)
 *   +/=  / -/_       → zoom (FOV)
 *   Space            → toggle play/pause
 *   M                → toggle mute
 *   F                → toggle fullscreen
 *   0                → reset view to defaults
 *
 * We listen on `window` rather than the container so the binding survives
 * focus moving to a child button — but we still gate on "is focus inside
 * the container" so multiple players on a page don't fight over keys.
 */
export function setupKeyboard(opts: KeyboardHandlerOptions): KeyboardHandler {
  const rotStep = opts.rotateStepDeg ?? 5;
  const fovStep = opts.fovStepDeg ?? 5;

  const onKey = (e: KeyboardEvent): void => {
    // Only respond when focus is inside our container.
    if (!opts.container.contains(document.activeElement)) return;
    // Don't hijack keys while the user is typing in a form control.
    const ae = document.activeElement as HTMLElement | null;
    if (ae) {
      const tag = ae.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ae.isContentEditable) {
        // But still allow the slider/progress bar to receive keys.
        if (ae.getAttribute('role') !== 'slider') return;
      }
    }

    switch (e.key) {
      case 'ArrowLeft':
        opts.view.rotateBy(-rotStep, 0); e.preventDefault(); break;
      case 'ArrowRight':
        opts.view.rotateBy(rotStep, 0); e.preventDefault(); break;
      case 'ArrowUp':
        opts.view.rotateBy(0, rotStep); e.preventDefault(); break;
      case 'ArrowDown':
        opts.view.rotateBy(0, -rotStep); e.preventDefault(); break;
      case '+':
      case '=':
        opts.view.zoomBy(-fovStep); e.preventDefault(); break; // smaller FOV = zoom in
      case '-':
      case '_':
        opts.view.zoomBy(fovStep); e.preventDefault(); break;
      case ' ':
      case 'Spacebar':
        opts.onPlayPause?.(); e.preventDefault(); break;
      case 'm':
      case 'M':
        opts.onToggleMute?.(); e.preventDefault(); break;
      case 'f':
      case 'F':
        opts.onToggleFullscreen?.(); e.preventDefault(); break;
      case '0':
        opts.onResetView?.(); e.preventDefault(); break;
      default:
        return;
    }
  };

  const cleanup = addListener(window, 'keydown', onKey as EventListener);

  return {
    destroy: () => cleanup(),
  };
}
