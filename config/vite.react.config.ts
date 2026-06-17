import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/react/**/*.ts', 'src/react/**/*.tsx', 'src/core/types.ts'],
      tsconfigPath: resolve(__dirname, '../tsconfig.build.json'),
      outDir: resolve(__dirname, '../dist'),
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, '../src/react/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: [
        'three',
        /^three\/.*/,
        'hls.js',
        'dashjs',
        /^dashjs/,
        'react',
        'react-dom',
        'react/jsx-runtime',
        // Keep the core external so the React wrapper stays thin; at runtime
        // the package self-reference resolves `/define` to the installed copy.
        /^@cloudimage\/360-video/,
      ],
    },
    sourcemap: true,
    outDir: resolve(__dirname, '../dist/react'),
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
});
