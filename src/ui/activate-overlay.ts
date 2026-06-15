import { createElement } from '../utils/dom';

export interface ActivateOverlayOptions {
  poster?: string;
  label?: string;
}

export interface ActivateOverlay {
  element: HTMLButtonElement;
  onActivate(cb: () => void): void;
  destroy(): void;
}

/**
 * "Click to play" gate.
 *
 * Browsers block autoplay-with-sound (and on iOS, autoplay of any kind in
 * some contexts) unless playback is initiated from a user gesture. The
 * activate overlay fronts the canvas with a play button until the user
 * clicks, satisfying the gesture requirement and unblocking `play()`.
 */
export function createActivateOverlay(opts: ActivateOverlayOptions = {}): ActivateOverlay {
  const root = createElement('button', 'ci-360-video-activate', {
    type: 'button',
    'aria-label': opts.label ?? 'Click to play 360° video',
  });

  if (opts.poster) {
    const img = document.createElement('img');
    img.src = opts.poster;
    img.alt = '';
    img.className = 'ci-360-video-activate-poster';
    root.appendChild(img);
  }

  const icon = createElement('span', 'ci-360-video-activate-icon');
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.5)" stroke="currentColor" stroke-width="1.5"/>' +
    '<polygon points="9,7 18,12 9,17" fill="currentColor"/></svg>';
  root.appendChild(icon);

  let callback: (() => void) | null = null;
  const onClick = (): void => {
    callback?.();
  };
  root.addEventListener('click', onClick);

  return {
    element: root,
    onActivate: (fn) => {
      callback = fn;
    },
    destroy: () => {
      root.removeEventListener('click', onClick);
      root.remove();
    },
  };
}
