import { addClass, createElement, removeClass } from '../utils/dom';

export interface ErrorOverlay {
  element: HTMLElement;
  show(message: string): void;
  hide(): void;
  destroy(): void;
}

/** Error overlay. `role="alert"` + `aria-live="assertive"` so SRs announce
 *  the failure promptly instead of waiting for the next polite cycle. */
export function createErrorOverlay(): ErrorOverlay {
  const root = createElement(
    'div',
    'ci-360-video-error ci-360-video-error--hidden',
    {
      role: 'alert',
      'aria-live': 'assertive',
    },
  );
  const icon = createElement('span', 'ci-360-video-error-icon');
  icon.textContent = '⚠';
  const message = createElement('span', 'ci-360-video-error-message');
  root.appendChild(icon);
  root.appendChild(message);

  return {
    element: root,
    show(text) {
      message.textContent = text;
      removeClass(root, 'ci-360-video-error--hidden');
    },
    hide() {
      addClass(root, 'ci-360-video-error--hidden');
      message.textContent = '';
    },
    destroy: () => root.remove(),
  };
}
