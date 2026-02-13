import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import pkg from './package.json';

const header = readFileSync('src/userscript/header.txt', 'utf-8');

export default defineConfig({
  build: {
    lib: {
      entry: 'src/userscript/index.ts',
      formats: ['iife'],
      name: 's2md',
      fileName: () => 's2md.user.js',
    },
    outDir: '.',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        banner: header,
      },
    },
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(pkg.version),
  },
});
