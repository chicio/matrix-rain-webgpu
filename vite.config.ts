import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import typegpu from 'unplugin-typegpu/vite';

export default defineConfig({
  root: 'src/demo',
  publicDir: 'src/demo/public',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  plugins: [react(), typegpu({})],
});
