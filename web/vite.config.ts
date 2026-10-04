import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend (server.js). Override with VITE_BACKEND_URL when it runs elsewhere.
const backend = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    // `../shared` holds the service-type list the server reads too; nothing else outside web/ is served.
    fs: { allow: ['.', '../shared'] },
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/geoserver-proxy': { target: backend, changeOrigin: true },
      '/socket.io': { target: backend, ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Live tests share the seeded dev accounts (one changes the admin password for a moment): run files one by one.
    fileParallelism: !process.env.VITE_LIVE_API,
  },
});
