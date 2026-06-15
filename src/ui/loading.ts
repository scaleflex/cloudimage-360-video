import { addClass, createElement, removeClass } from '../utils/dom';

export interface LoadingOverlay {
  element: HTMLElement;
  show(): void;
  hide(): void;
  destroy(): void;
}

/** Buffering / loading spinner. Toggled by the main class around `waiting`/`playing`
 *  adapter events. `aria-live="polite"` so screen readers announce state changes
 *  without interrupting other content. */
export function createLoadingOverlay(): LoadingOverlay {
  const root = createElement(
    'div',
    'ci-360-video-loading ci-360-video-loading--hidden',
    {
      role: 'status',
      'aria-live': 'polite',
      'aria-label': 'Loading',
    },
  );
  const spinner = createElement('div', 'ci-360-video-loading-spinner');
  root.appendChild(spinner);

  return {
    element: root,
    show: () => removeClass(root, 'ci-360-video-loading--hidden'),
    hide: () => addClass(root, 'ci-360-video-loading--hidden'),
    destroy: () => root.remove(),
  };
}
