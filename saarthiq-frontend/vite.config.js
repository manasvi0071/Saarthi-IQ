import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // This is the "magic" bridge
      '/saarthiq-proxy': {
        target: 'https://api.saarthiq.in', // The real API address
        changeOrigin: true,
        secure: false, // Set to false if the API has SSL issues
        rewrite: (path) => path.replace(/^\/saarthiq-proxy/, '')
      }
    }
  },
  preview: {
    port: 3000,
  },
  base: '/',
})