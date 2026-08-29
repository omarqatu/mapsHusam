import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
            '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      
      '/save-stat': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/geoserver-proxy': {
        target: 'http://194.163.174.162:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/geoserver-proxy/, '/geoserver'),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  publicDir: 'public',
})
