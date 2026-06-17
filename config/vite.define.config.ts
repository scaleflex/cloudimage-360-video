import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const pkgVersion = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8'),
).version as string;

/**
 * Emit `dist/define.d.ts` as a thin re-export of the main declarations
 * (already rolled into `dist/index.d.ts` by the bundle build, which also
 * exports `CI360VideoElement`). Avoids running the api-extractor rollup a
 * second time on the define graph.
 */
function emitDefineTypes(): Plugin {
  return {
    name: 'ci-360-video-emit-define-dts',
    closeBundle() {
      writeFileSync(
        resolve(__dirname, '../dist/define.d.ts'),
        `export * from './index';\nexport { CI360VideoElement } from './index';\n`,
      );
    },
  };
}

/**
 * Build for the `/define` subpath — the side-effect entry that registers the
 * `<ci-360-video>` custom element.
 *
 *   import '@cloudimage/360-video/define';
 *
 * three / hls.js / dashjs stay external (peer deps, same as the main bundle).
 * The element + engine are bundled so a single `/define` import is enough to
 * register and run; consumers pick either `.` (class) or `/define` (element).
 */
export default defineConfig({
  plugins: [emitDefineTypes()],
  define: {
    __CI360_VERSION__: JSON.stringify(pkgVersion),
  },
  build: {
    lib: {
      entry: resolve(__dirname, '../src/define.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'define.js' : 'define.cjs'),
    },
    rollupOptions: {
      external: ['three', /^three\/.*/, 'hls.js', 'dashjs'],
      output: { inlineDynamicImports: true, exports: 'named' },
    },
    sourcemap: true,
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: false,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '../src') },
  },
});
