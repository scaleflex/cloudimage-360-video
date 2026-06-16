// Post-build integrity guard.
//
// Regression guard for the "blank demo / unknown projection" bug: with
// `"sideEffects": false`, Rollup stripped the bare side-effect imports that
// register the projections (`import '../projection/equirectangular'`), so the
// production bundle shipped an empty projection registry and every player threw
// `unknown projection "equirectangular"` at runtime. Unit tests don't tree-shake,
// so they can't catch it — this checks the actual built artifacts instead.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const REQUIRED = ['equirectangular', 'fisheye', 'dual-fisheye'];
const BUNDLES = ['chunks/index.js', '360-video.cjs.js', '360-video.min.js'];

let failed = false;
for (const file of BUNDLES) {
  const path = resolve(dist, file);
  if (!existsSync(path)) { console.error(`✗ missing bundle: ${file}`); failed = true; continue; }
  const code = readFileSync(path, 'utf8');
  const missing = REQUIRED.filter((name) => !code.includes(`"${name}"`));
  if (missing.length) {
    console.error(`✗ ${file}: projection(s) not registered — ${missing.join(', ')} (tree-shaking stripped registration?)`);
    failed = true;
  } else {
    console.log(`✓ ${file}: projections registered (${REQUIRED.join(', ')})`);
  }
}

if (failed) { console.error('\nBundle integrity check FAILED.'); process.exit(1); }
console.log('\nBundle integrity check passed.');
