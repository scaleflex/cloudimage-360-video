/** Ensure the container is keyboard-focusable. Idempotent and SSR-safe. */
export function setupFocusManagement(container: HTMLElement): void {
  if (!container.hasAttribute('tabindex')) {
    container.setAttribute('tabindex', '0');
  }
}

export function focusContainer(container: HTMLElement): void {
  try {
    container.focus({ preventScroll: true });
  } catch {
    container.focus();
  }
}
