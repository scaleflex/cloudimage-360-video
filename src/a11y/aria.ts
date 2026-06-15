/**
 * ARIA convention for the 360 video player.
 *
 * Container is `role="application"` so screen readers cede arrow-key handling
 * to us — without this, the SR's own browse mode would steal ArrowLeft/Right
 * and our view-rotation never fires. `aria-roledescription` tells the user
 * what kind of application this actually is.
 *
 * Canvas is `role="img"` with the same alt text so SR users at least get a
 * description of what's on screen.
 */
export function setContainerAria(container: HTMLElement, alt = '360° video'): void {
  container.setAttribute('role', 'application');
  container.setAttribute('aria-roledescription', '360 video player');
  container.setAttribute('aria-label', alt);
  if (!container.hasAttribute('tabindex')) {
    container.setAttribute('tabindex', '0');
  }
}

export function setCanvasAria(canvas: HTMLCanvasElement, alt = '360° video'): void {
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', alt);
}

export function clearContainerAria(container: HTMLElement): void {
  ['role', 'aria-roledescription', 'aria-label'].forEach((a) => container.removeAttribute(a));
}
