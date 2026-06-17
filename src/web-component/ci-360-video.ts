/**
 * `<ci-360-video>` — the Web Component wrapper around the {@link CI360Video}
 * engine. Vanilla custom element (no Lit): the engine renders the WebGL canvas
 * and toolbar itself, so this is a thin shell that
 *
 *  - reads bare kebab attributes (`src`, `autoplay`, `auto-rotate`, …) into config
 *    via the shared {@link ATTR_MAP} (see `core/config.ts`);
 *  - accepts complex/non-attribute config (`sources`, `on*` callbacks) as JS
 *    properties;
 *  - mounts the engine into a `<div>` inside its **open Shadow DOM** (styles are
 *    scoped there — see the Shadow-DOM-aware `injectStyles` in `utils/dom.ts`);
 *  - re-dispatches every engine event as a composed, bubbling
 *    `ci-360-video-<name>` CustomEvent;
 *  - forwards the full imperative API (play/pause/getView/…).
 *
 * Registration lives in `src/define.ts` (side-effect entry) — importing this
 * module alone does not register the element.
 */
import { CI360Video } from '../core/ci-360-video';
import {
  OBSERVED_ATTRIBUTES,
  coerceAttribute,
  parseAttributes,
} from '../core/config';
import type {
  CI360VideoConfig,
  CI360VideoInstance,
  ScreenPoint,
  ThreeObjects,
  ViewState,
} from '../core/types';
import type { EventHandler } from '../utils/events';

/** Engine EventEmitter names re-dispatched as `ci-360-video-<name>`. */
const FORWARDED_EVENTS = [
  'ready', 'play', 'pause', 'timeupdate', 'durationchange', 'ended',
  'waiting', 'playing', 'progress', 'volumechange', 'error',
  'qualitylevelsupdated', 'qualitychange', 'ratechange',
  'view-change', 'fullscreen-change',
] as const;

/** Config keys that can't be live-updated (mesh/source level) — remount instead. */
const REMOUNT_KEYS = new Set<keyof CI360VideoConfig>(['src', 'sources', 'projection', 'stereo']);

export class CI360VideoElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return OBSERVED_ATTRIBUTES;
  }

  private _instance: CI360Video | null = null;
  private _container: HTMLDivElement | null = null;
  /** Config set via JS properties (sources, callbacks, …), merged over attributes. */
  private _propConfig: Partial<CI360VideoConfig> = {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // --- lifecycle -----------------------------------------------------------

  connectedCallback(): void {
    if (this._instance) return; // already mounted (e.g. re-attached)
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.style.cssText = 'width:100%;height:100%;display:block';
      this.shadowRoot!.appendChild(this._container);
    }
    this.mount();
  }

  disconnectedCallback(): void {
    this._instance?.destroy();
    this._instance = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this._instance) return; // initial attributes are read in mount()
    const parsed = coerceAttribute(name, value);
    if (!parsed) return;
    if (REMOUNT_KEYS.has(parsed.key)) {
      this.mount();
    } else {
      this._instance.update({ [parsed.key]: parsed.value } as Partial<CI360VideoConfig>);
    }
  }

  /** (Re)create the engine from current attributes + property config. */
  private mount(): void {
    if (!this._container) return;
    this._instance?.destroy();
    const config = { ...parseAttributes(this), ...this._propConfig };
    this._instance = new CI360Video(this._container, config);
    for (const name of FORWARDED_EVENTS) {
      this._instance.on(name, (detail?: unknown) => {
        this.dispatchEvent(
          new CustomEvent(`ci-360-video-${name}`, { detail, bubbles: true, composed: true }),
        );
      });
    }
  }

  /** Set a config value from a JS property: store it and apply if mounted. */
  private setConfig<K extends keyof CI360VideoConfig>(key: K, value: CI360VideoConfig[K]): void {
    this._propConfig[key] = value;
    if (!this._instance) return;
    if (REMOUNT_KEYS.has(key)) this.mount();
    else this._instance.update({ [key]: value } as Partial<CI360VideoConfig>);
  }

  // --- property accessors for non-attribute config -------------------------

  /** Full config object setter — merges over current property config. */
  set config(value: Partial<CI360VideoConfig>) {
    this._propConfig = { ...this._propConfig, ...value };
    if (this._instance) this.mount();
  }
  get config(): Partial<CI360VideoConfig> {
    return this._propConfig;
  }

  set sources(v: CI360VideoConfig['sources']) { this.setConfig('sources', v); }
  get sources(): CI360VideoConfig['sources'] { return this._propConfig.sources; }

  set onReady(v: CI360VideoConfig['onReady']) { this.setConfig('onReady', v); }
  get onReady(): CI360VideoConfig['onReady'] { return this._propConfig.onReady; }
  set onPlay(v: CI360VideoConfig['onPlay']) { this.setConfig('onPlay', v); }
  get onPlay(): CI360VideoConfig['onPlay'] { return this._propConfig.onPlay; }
  set onPause(v: CI360VideoConfig['onPause']) { this.setConfig('onPause', v); }
  get onPause(): CI360VideoConfig['onPause'] { return this._propConfig.onPause; }
  set onTimeUpdate(v: CI360VideoConfig['onTimeUpdate']) { this.setConfig('onTimeUpdate', v); }
  get onTimeUpdate(): CI360VideoConfig['onTimeUpdate'] { return this._propConfig.onTimeUpdate; }
  set onDurationChange(v: CI360VideoConfig['onDurationChange']) { this.setConfig('onDurationChange', v); }
  get onDurationChange(): CI360VideoConfig['onDurationChange'] { return this._propConfig.onDurationChange; }
  set onEnded(v: CI360VideoConfig['onEnded']) { this.setConfig('onEnded', v); }
  get onEnded(): CI360VideoConfig['onEnded'] { return this._propConfig.onEnded; }
  set onViewChange(v: CI360VideoConfig['onViewChange']) { this.setConfig('onViewChange', v); }
  get onViewChange(): CI360VideoConfig['onViewChange'] { return this._propConfig.onViewChange; }
  set onFullscreenChange(v: CI360VideoConfig['onFullscreenChange']) { this.setConfig('onFullscreenChange', v); }
  get onFullscreenChange(): CI360VideoConfig['onFullscreenChange'] { return this._propConfig.onFullscreenChange; }
  set onError(v: CI360VideoConfig['onError']) { this.setConfig('onError', v); }
  get onError(): CI360VideoConfig['onError'] { return this._propConfig.onError; }

  // --- imperative API (delegates to the engine; null-safe) -----------------

  /** The underlying engine instance, or null before mount / after teardown. */
  get instance(): CI360VideoInstance | null { return this._instance; }

  /** EventEmitter passthroughs (also available as `ci-360-video-*` DOM events). */
  on(event: string, handler: EventHandler): void { this._instance?.on(event, handler); }
  off(event: string, handler: EventHandler): void { this._instance?.off(event, handler); }
  once(event: string, handler: EventHandler): void { this._instance?.once(event, handler); }
  /** Tear down the engine (the element itself stays in the DOM). */
  destroy(): void { this._instance?.destroy(); this._instance = null; }

  play(): Promise<void> { return this._instance?.play() ?? Promise.resolve(); }
  pause(): void { this._instance?.pause(); }
  seek(time: number): void { this._instance?.seek(time); }
  isPaused(): boolean { return this._instance?.isPaused() ?? true; }
  getCurrentTime(): number { return this._instance?.getCurrentTime() ?? 0; }
  getDuration(): number { return this._instance?.getDuration() ?? 0; }
  setMuted(muted: boolean): void { this._instance?.setMuted(muted); }
  isMuted(): boolean { return this._instance?.isMuted() ?? false; }
  setVolume(volume: number): void { this._instance?.setVolume(volume); }
  getVolume(): number { return this._instance?.getVolume() ?? 1; }
  getView(): ViewState { return this._instance?.getView() ?? { lon: 0, lat: 0, fov: 0 }; }
  setView(view: Partial<ViewState>, animate?: boolean): void { this._instance?.setView(view, animate); }
  latLonToScreen(lon: number, lat: number): ScreenPoint {
    return this._instance?.latLonToScreen(lon, lat) ?? { x: 0, y: 0, visible: false };
  }
  enterFullscreen(): void { this._instance?.enterFullscreen(); }
  exitFullscreen(): void { this._instance?.exitFullscreen(); }
  isFullscreen(): boolean { return this._instance?.isFullscreen() ?? false; }
  enterVR(): Promise<void> { return this._instance?.enterVR() ?? Promise.resolve(); }
  setVRView(on?: boolean): void { this._instance?.setVRView(on); }
  isVRView(): boolean { return this._instance?.isVRView() ?? false; }
  update(config: Partial<CI360VideoConfig>): void { this._instance?.update(config); }
  getThreeObjects(): ThreeObjects | null { return this._instance?.getThreeObjects() ?? null; }
}

declare global {
  interface HTMLElementTagNameMap {
    'ci-360-video': CI360VideoElement;
  }
}
