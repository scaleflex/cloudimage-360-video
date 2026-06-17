export type EventHandler = (...args: any[]) => void;

/**
 * Minimal typed event emitter used both by the public API surface and by the
 * internal video adapter layer. Errors thrown in a handler are caught and logged
 * so one bad subscriber can't break the rest of the system.
 */
export class EventEmitter {
  private listeners = new Map<string, Set<EventHandler>>();
  // `once` wrappers keyed by (event → original handler → wrapper). Keying per
  // event (not just by handler) means the same function can be registered as a
  // one-shot listener on several events without the registrations clobbering
  // each other in a single shared map.
  private onceMap = new Map<string, Map<EventHandler, EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const wrapper = this.onceMap.get(event)?.get(handler);
    if (wrapper) {
      this.listeners.get(event)?.delete(wrapper);
      this.onceMap.get(event)?.delete(handler);
    } else {
      this.listeners.get(event)?.delete(handler);
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    [...handlers].forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`EventEmitter: handler for "${event}" threw:`, err);
      }
    });
  }

  once(event: string, handler: EventHandler): void {
    const wrapper = (...args: any[]) => {
      // Remove via the original handler so `off(event, handler)` and the
      // self-removal here resolve to the same wrapper entry.
      this.off(event, handler);
      handler(...args);
    };
    let perEvent = this.onceMap.get(event);
    if (!perEvent) {
      perEvent = new Map();
      this.onceMap.set(event, perEvent);
    }
    perEvent.set(handler, wrapper);
    this.on(event, wrapper);
  }

  removeAllListeners(): void {
    this.listeners.clear();
    this.onceMap.clear();
  }
}

/** Add a DOM event listener and return an unsubscribe function. */
export function addListener(
  el: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): () => void {
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

export type ThrottledFunction<T extends (...args: any[]) => void> = T & { cancel(): void };

/**
 * Leading-and-trailing throttle. Returns the function with a `.cancel()` to
 * clear any pending trailing call (used by `destroy()`).
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): ThrottledFunction<T> {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  // The trailing edge must fire with the MOST RECENT args (and `this`), not the
  // call that happened to schedule the timer — otherwise e.g. `onViewChange`'s
  // final emit lands a frame or two behind the real view. We capture both in a
  // thunk re-created on every call, which also sidesteps aliasing `this`.
  let pending: (() => void) | null = null;

  const throttled = function (this: any, ...args: any[]) {
    pending = () => fn.apply(this, args);
    const now = Date.now();
    const remaining = ms - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      const run = pending;
      pending = null;
      run();
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        const run = pending;
        pending = null;
        run?.();
      }, remaining);
    }
  } as ThrottledFunction<T>;

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pending = null;
  };

  return throttled;
}
