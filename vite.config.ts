import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['recharts'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['awejn-82-194-6-85.free.pinggy.net'],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
