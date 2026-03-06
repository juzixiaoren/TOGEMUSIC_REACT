import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 14514,
    proxy: {
      '/reverse': {
        target: 'http://localhost:8034', // 后端服务地址
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8034',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: 'http://localhost:8034', // 后端服务地址
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    },
  },
})