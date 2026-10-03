import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Stable vendor chunks cache across deploys; app code stays small.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          clerk: ['@clerk/clerk-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Local sandbox development: the frontend keeps using /api while Vite
    // forwards those requests to the Klin backend on port 3000. Production
    // deployments still use VITE_API_BASE directly.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  }
});
