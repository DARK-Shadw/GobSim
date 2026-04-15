import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './client',
  publicDir: '../Assets',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  server: {
    open: true,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
