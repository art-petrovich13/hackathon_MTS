import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Добавьте эту секцию для разрешения всех хостов Cloudflare Tunnel
    allowedHosts: [
      'localhost',
      '.trycloudflare.com',  // Разрешает все поддомены trycloudflare.com
      // Или конкретный хост, который вы видите в ошибке:
      'valued-pendant-stations-doctrine.trycloudflare.com'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})