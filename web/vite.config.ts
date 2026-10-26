import { defineConfig } from 'vite';
// En GitHub Pages la app vive en /huehueteotl/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/huehueteotl/',
  build: { chunkSizeWarningLimit: 1500 },
});
