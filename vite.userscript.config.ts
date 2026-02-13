import { defineConfig, Plugin } from 'vite';
import { readFileSync } from 'fs';
import pkg from './package.json';

const header = readFileSync('src/userscript/header.txt', 'utf-8');

// Injects the ==UserScript== header after minification so esbuild
// doesn't strip the // comments.
function userscriptBanner(): Plugin {
  return {
    name: 'userscript-banner',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk') {
          chunk.code = header + '\n' + chunk.code;
        }
      }
    },
  };
}

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
  },
  plugins: [userscriptBanner()],
  define: {
    __BUILD_VERSION__: JSON.stringify(pkg.version),
  },
});
