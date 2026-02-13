import { resolve } from 'path';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';
import pkg from './package.json';

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  define: {
    __BUILD_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
      },
    },
  },
});
