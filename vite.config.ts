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
        // Keep React and Clerk in one chunk: separating them creates a
        // circular ESM dependency (Clerk -> React -> Clerk) that can leave
        // React undefined during Clerk's initialization in production.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', '@clerk/clerk-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Local sandbox development: the frontend keeps using /api while Vite
    // forwards requests to the backend's default port (8787). Override with
    // KILN_API_PROXY_TARGET when the backend runs elsewhere. Production
    // deployments still use VITE_API_BASE directly.
    proxy: {
      '/api': {
        target: process.env.KILN_API_PROXY_TARGET || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  }
});
