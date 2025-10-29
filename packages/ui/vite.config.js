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
      '/api': {
        target: 'http://localhost:7676',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:7676',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying for SSE
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  define: {
    // Prevent cytoscape-elk from trying to require elkjs dynamically
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});

