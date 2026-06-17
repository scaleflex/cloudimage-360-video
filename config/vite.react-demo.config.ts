import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve(__dirname, '../demo/react-demo'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../dist-react-demo'),
    emptyOutDir: true,
  },
  server: {
    port: 5262,
    host: true,
    open: true,
    strictPort: true,
  },
  resolve: {
    alias: {
      // The React wrapper imports the core via package specifiers; in the demo
      // (which runs from source) point them back at src so dev:react works.
      // More specific (/define) first — Vite matches by longest prefix.
      '@cloudimage/360-video/define': resolve(__dirname, '../src/define.ts'),
      '@cloudimage/360-video': resolve(__dirname, '../src/index.ts'),
      '@': resolve(__dirname, '../src'),
    },
  },
});
