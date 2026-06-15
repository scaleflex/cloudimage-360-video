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

export const VERSION = '1.3.0';
