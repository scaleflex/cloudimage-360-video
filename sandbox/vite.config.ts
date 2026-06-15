import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

// Standalone sandbox for trying the player against the live source (no build
// step). Run with:  npm run sandbox
export default defineConfig({
  root: resolve(__dirname),
  base: './',
  plugins: [react()],
  server: { port: 4000, open: true },
  resolve: {
    // Longer (more specific) aliases first — Vite matches by prefix. These map
    // the published package specifiers onto the local `src/` so the sandbox
    // exercises the same import paths consumers use. The CSS is injected at
    // runtime by the core, so `/css` is here only for completeness.
    alias: {
      '@cloudimage/360-video/react': resolve(__dirname, '../src/react/index.ts'),
      '@cloudimage/360-video/filerobot': resolve(__dirname, '../src/filerobot/index.ts'),
      '@cloudimage/360-video/css': resolve(__dirname, '../src/styles/index.css'),
      '@cloudimage/360-video': resolve(__dirname, '../src/index.ts'),
    },
  },
});
