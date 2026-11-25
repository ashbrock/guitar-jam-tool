import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Builds are published to GitHub Pages at https://<user>.github.io/guitar-jam-tool/, so production
// paths (and `vite preview`) live under /guitar-jam-tool/. The dev server stays at the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/guitar-jam-tool/' : '/',
  build: {
    rollupOptions: {
      // Every page to publish (Vite only builds the root index.html unless told otherwise).
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        generative: resolve(import.meta.dirname, 'design/explorations/04-generative/index.html'),
        pixelTiles: resolve(import.meta.dirname, 'design/explorations/03-pixel-tiles/index.html'),
        lateSetChart: resolve(import.meta.dirname, 'design/explorations/02-late-set-chart/index.html'),
      },
    },
  },
}));
