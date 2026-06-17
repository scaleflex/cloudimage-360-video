import { defineConfig } from 'vite';
import { resolve } from 'path';

// `base` must match the GitHub Pages sub-path (repo name) for production builds
// so bundled asset URLs resolve under https://scaleflex.github.io/cloudimage-360-video/.
// Local dev stays at `/` for a clean `npm run dev`.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cloudimage-360-video/' : '/',
  root: resolve(__dirname, '../demo'),
  build: {
    outDir: resolve(__dirname, '../dist-demo'),
    emptyOutDir: true,
  },
  server: {
    port: 5261,
    host: true,
    open: true,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
}));
