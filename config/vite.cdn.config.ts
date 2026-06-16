import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Standalone CDN build — a single self-contained UMD bundle for
 * `<script src=".../360-video.min.js">` consumption (CDN + unpkg).
 *
 * Unlike the npm bundle (`vite.config.ts`, which keeps `three` external as a
 * peer dependency), **three is bundled in** here. Modern three (r150+) ships no
 * UMD global build, so `<script src="unpkg.com/three">` does not define
 * `window.THREE` — a three-external UMD would never boot from a plain script
 * tag. Bundling three makes the file work on its own.
 *
 * `hls.js` / `dashjs` stay external (optional globals `Hls` / `dashjs`): they
 * are only needed for HLS/DASH streaming and would more than double the file.
 * Plain MP4/WebM needs nothing but this one script. The bundle attaches a
 * namespace object at `window.CI360Video` (class is `window.CI360Video.CI360Video`).
 *
 * Output: dist/360-video.min.js  (appended next to the esm/cjs bundle —
 * emptyOutDir is false so it does not wipe vite.config.ts output).
 */
export default defineConfig({
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: false,
    sourcemap: true,
    minify: 'esbuild',
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, '../src/index.ts'),
      name: 'CI360Video',
      formats: ['umd'],
      fileName: () => '360-video.min.js',
    },
    rollupOptions: {
      // three is bundled; only the optional streaming peers stay external.
      external: ['hls.js', 'dashjs'],
      output: {
        format: 'umd',
        entryFileNames: '360-video.min.js',
        inlineDynamicImports: true,
        name: 'CI360Video',
        exports: 'named',
        globals: (id: string) => {
          if (id === 'hls.js') return 'Hls';
          if (id === 'dashjs') return 'dashjs';
          return id;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
});
