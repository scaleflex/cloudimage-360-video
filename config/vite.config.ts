import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/react/**/*', 'tests/**/*'],
      rollupTypes: true,
      tsconfigPath: resolve(__dirname, '../tsconfig.build.json'),
    }),
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
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
    },
  },
});
