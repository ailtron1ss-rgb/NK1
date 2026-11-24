import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
    strictPort: true
  },
  optimizeDeps: {
    // mid-range Android / Termux friendliness
    exclude: []
  },
  build: {
    chunkSizeWarningLimit: 1200
  }
});
