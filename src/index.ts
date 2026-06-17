/**
 * Public entry point for `@cloudimage/360-video`.
 *
 * UMD bundles expose the default export as the global `CI360Video`, so both
 * `import CI360Video from '@cloudimage/360-video'` and a `<script>` tag with
 * `new CI360Video(el, …)` work without further setup.
 */

import { CI360Video } from './core/ci-360-video';

export default CI360Video;
export { CI360Video };

// The Web Component class (registration is side-effectful — see `/define`).
export { CI360VideoElement } from './web-component/ci-360-video';

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

export type { Projection } from './projection/projection';
export type { Eye } from './texture/eye-mapping';

// Injected at build time from package.json via each vite config's `define`
// (see config/vite.*.config.ts) so it never drifts from the published version.
// `typeof` guard keeps it safe under vitest, where the macro isn't defined.
declare const __CI360_VERSION__: string;
export const VERSION: string =
  typeof __CI360_VERSION__ !== 'undefined' ? __CI360_VERSION__ : '0.0.0';
