import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import typegpu from 'unplugin-typegpu/vite';

// Library build for npm. unplugin-typegpu transforms the `'use gpu'` TGSL at
// BUILD time (Babel), so the published JS is self-contained — consumers need
// no TypeGPU build plugin. Peers are externalized so the consumer provides a
// single instance (see the 91bc083 duplicate-instance bug).
export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react(), typegpu({}) as any],
  build: {
    target: 'esnext',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', /^@typegpu\//, 'typegpu'],
    },
  },
});
