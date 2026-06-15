import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

/**
 * Build for the `/filerobot` subpath.
 *
 * Vendor-specific helpers live in a separate entry so they are tree-shaken
 * out of the main bundle for consumers who don't use Filerobot — only the
 * code that calls `import('@cloudimage/360-video/filerobot')` pulls this in.
 */
export default defineConfig({
  plugins: [
    dts({
      include: ['src/filerobot/**/*.ts'],
      tsconfigPath: resolve(__dirname, '../tsconfig.build.json'),
      outDir: resolve(__dirname, '../dist/filerobot'),
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, '../src/filerobot/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      // The helper is pure (no runtime imports from core); nothing to externalize.
      external: [],
    },
    sourcemap: true,
    outDir: resolve(__dirname, '../dist/filerobot'),
    emptyOutDir: false,
  },
});
