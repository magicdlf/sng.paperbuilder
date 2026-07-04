import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const server = `http://127.0.0.1:${process.env.HIMCM_PORT ?? '4870'}`

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': server,
      '/assets': server,
      '/pdf': server,
    },
  },
})
