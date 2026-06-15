import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
import dts from 'vite-plugin-dts';

/**
 * Emit a standalone `dist/style.css` alongside the JS bundles.
 *
 * The core injects its stylesheet at runtime (imported with `?inline`), so Vite
 * does not produce a CSS asset on its own. We still publish a real file so the
 * `"./css"` export resolves — needed by consumers on strict CSP setups that
 * forbid runtime `<style>` injection and want to self-host the stylesheet.
 */
function emitStandaloneCss(): Plugin {
  return {
    name: 'ci-360-video-emit-css',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, '../src/styles/index.css'),
        resolve(__dirname, '../dist/style.css'),
      );
    },
  };
}

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/react/**/*', 'tests/**/*'],
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, '../tsconfig.build.json'),
    }),
    emitStandaloneCss(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, '../src/index.ts'),
    },
    rollupOptions: {
      external: ['three', /^three\/.*/, 'hls.js', 'dashjs'],
      output: [
        {
          format: 'es',
          entryFileNames: '360-video.esm.js',
          chunkFileNames: 'chunks/[name].js',
          exports: 'named',
        },
        {
          format: 'cjs',
          entryFileNames: '360-video.cjs.js',
          inlineDynamicImports: true,
          exports: 'named',
        },
        {
          format: 'umd',
          entryFileNames: '360-video.min.js',
          inlineDynamicImports: true,
          name: 'CI360Video',
          exports: 'named',
          globals: (id: string) => {
            if (id === 'three' || id.startsWith('three/')) return 'THREE';
            if (id === 'hls.js') return 'Hls';
            if (id === 'dashjs') return 'dashjs';
            return id;
          },
        },
      ],
    },
    sourcemap: true,
    minify: 'esbuild',
    outDir: resolve(__dirname, '../dist'),
    // First build in the chain (build:bundle → build:react → build:filerobot):
    // wipe dist once here so stale artifacts from previous builds (e.g. an
    // old bundled core/dashjs in dist/react) never linger into a publish. The
    // later react/filerobot builds keep `emptyOutDir: false` so they append.
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
});
