import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Renderer (React) build config. Electron main/preload are compiled
// separately via electron/tsconfig.json -> dist-electron.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './',
  esbuild: {
    drop: mode === 'production' ? ['debugger'] : [],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/dist/**', '**/dist-electron/**', '**/.system_generated/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
}));
