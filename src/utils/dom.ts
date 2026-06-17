export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getElement(selectorOrElement: HTMLElement | string): HTMLElement {
  if (typeof selectorOrElement === 'string') {
    const el = document.querySelector<HTMLElement>(selectorOrElement);
    if (!el) {
      throw new Error(`CI360Video: Element not found for selector "${selectorOrElement}"`);
    }
    return el;
  }
  return selectorOrElement;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

export function addClass(el: HTMLElement, ...classNames: string[]): void {
  el.classList.add(...classNames);
}

export function removeClass(el: HTMLElement, ...classNames: string[]): void {
  el.classList.remove(...classNames);
}

export function toggleClass(el: HTMLElement, className: string, force?: boolean): void {
  el.classList.toggle(className, force);
}

/**
 * Where the stylesheet is mounted. The document head for the class / light-DOM
 * API; a ShadowRoot when the player lives inside a custom element.
 */
export type StyleRoot = Document | ShadowRoot;

// Ref-count per root so each ShadowRoot keeps its own <style> while light-DOM
// instances on the same document still share one tag.
const styleRefCounts = new WeakMap<StyleRoot, Map<string, number>>();

function styleContainer(root: StyleRoot): ParentNode {
  return root === document ? document.head : (root as ShadowRoot);
}

function findStyle(root: StyleRoot, id: string): HTMLStyleElement | null {
  return styleContainer(root).querySelector<HTMLStyleElement>(`style#${id}`);
}

/**
 * Inject a CSS string into `root` once per `id`, ref-counted. Defaults to the
 * document head (class / light-DOM usage); pass a ShadowRoot to scope the
 * stylesheet inside a custom element.
 */
export function injectStyles(css: string, id: string, root: StyleRoot = document): void {
  if (!isBrowser()) return;

  let counts = styleRefCounts.get(root);
  if (!counts) {
    counts = new Map();
    styleRefCounts.set(root, counts);
  }
  counts.set(id, (counts.get(id) ?? 0) + 1);

  if (findStyle(root, id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  styleContainer(root).appendChild(style);
}

export function removeStyles(id: string, root: StyleRoot = document): void {
  if (!isBrowser()) return;

  const counts = styleRefCounts.get(root);
  const count = (counts?.get(id) ?? 0) - 1;
  if (count < 0) return;
  if (count <= 0) {
    counts?.delete(id);
    findStyle(root, id)?.remove();
  } else {
    counts!.set(id, count);
  }
}
