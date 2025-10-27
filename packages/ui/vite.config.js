import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/graph': {
        target: 'http://localhost:7676',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ['elkjs'],
  },
  resolve: {
    alias: {
      // Fix ELK worker issue in browser
      'web-worker': 'elkjs/lib/elk-api.js',
    },
  },
});

