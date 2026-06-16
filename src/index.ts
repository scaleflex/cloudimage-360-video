/**
 * Public entry point for `@scaleflex/360-video`.
 *
 * UMD bundles expose the default export as the global `CI360Video`, so both
 * `import CI360Video from '@scaleflex/360-video'` and a `<script>` tag with
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

// Sourced from package.json so it never drifts from the published version.
// Rollup inlines only the `version` field (named import → dead-code-eliminated).
import { version as VERSION } from '../package.json';
export { VERSION };
