/**
 * Side-effect entry: registers the `<ci-360-video>` custom element.
 *
 *   import '@cloudimage/360-video/define';   // ESM bundlers
 *   <script src=".../360-video.min.js">      // CDN (this is the UMD entry too)
 *
 * Safe to import more than once (React StrictMode, repeated bundles) — the
 * `customElements.get` guard makes registration idempotent. Re-exports the
 * class API so the UMD global keeps `window.CI360Video.CI360Video`.
 */
import { CI360VideoElement } from './web-component/ci-360-video';

if (typeof customElements !== 'undefined' && !customElements.get('ci-360-video')) {
  customElements.define('ci-360-video', CI360VideoElement);
}

// Re-export the class API so the UMD global keeps window.CI360Video.CI360Video
// (and .VERSION). `define.d.ts` is hand-written (see vite.define.config.ts), so
// there's no api-extractor pass here to trip over the injected VERSION const.
export { CI360Video, VERSION, default } from './index';
export { CI360VideoElement };
export type {
  CI360VideoConfig,
  CI360VideoInstance,
  ViewState,
  ScreenPoint,
  ThreeObjects,
  ProjectionType,
  StereoLayout,
  StereoOption,
  PlayerType,
  Theme,
} from './core/types';
