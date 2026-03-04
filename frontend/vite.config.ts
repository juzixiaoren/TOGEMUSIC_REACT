import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/login': {
        target: 'http://127.0.0.1:8034',
        changeOrigin: true,
      },
      '/register': {
        target: 'http://127.0.0.1:8034',
        changeOrigin: true,
      },
      '/protected': {
        target: 'http://127.0.0.1:8034',
        changeOrigin: true,
      },
      '^/(songs|playlists|getAllPlaylists|upload|uploadchunkinit|uploadchunk|uploadchunkmerge|users|getplaystatus|getplaysongs|requestplay|clearplaylist|removesongfromplaylist|reorderPlaylist)(/.*)?$': {
        target: 'http://127.0.0.1:8034',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:8034',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
