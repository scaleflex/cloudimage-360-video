import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import '../src/define'; // registers <ci-360-video>
import type { CI360VideoElement } from '../src/web-component/ci-360-video';

function mount(
  attrs: Record<string, string> = {},
  props: Partial<Record<string, unknown>> = {},
): CI360VideoElement {
  const el = document.createElement('ci-360-video') as CI360VideoElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const [k, v] of Object.entries(props)) (el as unknown as Record<string, unknown>)[k] = v;
  document.body.appendChild(el);
  return el;
}

/** The engine's EventEmitter, for driving bridge assertions deterministically. */
function emitter(el: CI360VideoElement): { emit: (e: string, ...a: unknown[]) => void } {
  return el.instance as unknown as { emit: (e: string, ...a: unknown[]) => void };
}

describe('<ci-360-video> custom element', () => {
  // The shared setup mocks pause() to dispatch 'pause' on a microtask; for an
  // element whose <video> is torn down on disconnect, that dispatch fires after
  // teardown and surfaces as an unhandled jsdom error. These tests don't assert
  // on pause, so quiet it to a plain no-op (vitest isolates jsdom per file).
  beforeAll(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: function pause(this: HTMLMediaElement) {},
    });
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('is registered', async () => {
    await customElements.whenDefined('ci-360-video');
    expect(customElements.get('ci-360-video')).toBeTruthy();
  });

  it('boots the engine into its shadow root on connect', () => {
    const el = mount({ src: 'a.mp4' });
    expect(el.shadowRoot).toBeTruthy();
    expect(el.instance).not.toBeNull();
    // engine container + its canvas live inside the shadow root
    expect(el.shadowRoot!.querySelector('.ci-360-video')).toBeTruthy();
  });

  it('scopes its stylesheet inside the shadow root (not document head)', () => {
    const el = mount({ src: 'a.mp4' });
    expect(el.shadowRoot!.querySelector('style#ci-360-video-styles')).toBeTruthy();
    expect(document.head.querySelector('style#ci-360-video-styles')).toBeNull();
  });

  it('maps bare kebab attributes onto config', () => {
    const el = mount({ src: 'a.mp4', theme: 'light', 'auto-rotate': 'true' });
    // theme is reflected onto the engine container's data-theme
    expect(el.shadowRoot!.querySelector('.ci-360-video')!.getAttribute('data-theme')).toBe('light');
  });

  it('accepts complex config (callbacks, sources) as properties', () => {
    const onReady = (): void => {};
    const sources = [{ src: 'x.mp4', label: '4K', height: 2160 }];
    const el = mount({ src: 'a.mp4' }, { onReady, sources });
    // Stored and forwarded into the engine config.
    expect(el.config.onReady).toBe(onReady);
    expect(el.config.sources).toBe(sources);
  });

  it('re-dispatches engine events as composed, bubbling CustomEvents', () => {
    const el = mount({ src: 'a.mp4' });
    const received: CustomEvent[] = [];
    document.body.addEventListener('ci-360-video-timeupdate', (e) => received.push(e as CustomEvent));
    emitter(el).emit('timeupdate', 12.5);
    expect(received).toHaveLength(1);
    expect(received[0].detail).toBe(12.5);
    expect(received[0].bubbles).toBe(true);
    expect(received[0].composed).toBe(true);
  });

  it('live-updates non-mesh attributes without remounting', () => {
    const el = mount({ src: 'a.mp4', theme: 'dark' });
    const before = el.instance;
    el.setAttribute('theme', 'light');
    expect(el.instance).toBe(before); // same engine instance — update(), not remount
    expect(el.shadowRoot!.querySelector('.ci-360-video')!.getAttribute('data-theme')).toBe('light');
  });

  it('remounts the engine when src changes', () => {
    const el = mount({ src: 'a.mp4' });
    const before = el.instance;
    el.setAttribute('src', 'b.mp4');
    expect(el.instance).not.toBe(before);
  });

  it('exposes the imperative API delegating to the engine', () => {
    const el = mount({ src: 'a.mp4' });
    expect(typeof el.play).toBe('function');
    const view = el.getView();
    expect(view).toHaveProperty('lon');
    expect(view).toHaveProperty('fov');
  });

  it('destroys the engine on disconnect and is safe to re-append', () => {
    const el = mount({ src: 'a.mp4' });
    expect(el.instance).not.toBeNull();
    el.remove();
    expect(el.instance).toBeNull();
    expect(() => document.body.appendChild(el)).not.toThrow();
    expect(el.instance).not.toBeNull(); // re-mounts cleanly
  });
});
