import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('recharts')) {
            return 'vendor-recharts'
          }
          if (id.includes('d3-')) {
            return 'vendor-d3'
          }
          if (id.includes('@tanstack')) {
            return 'vendor-query'
          }
          if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('redux')) {
            return 'vendor-state'
          }
          if (id.includes('react-router')) {
            return 'vendor-router'
          }
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'vendor-i18n'
          }
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
            return 'vendor-forms'
          }
          if (id.includes('@sentry')) {
            return 'vendor-observability'
          }
          if (id.includes('socket.io-client')) {
            return 'vendor-realtime'
          }
          if (id.includes('react-icons')) {
            return 'vendor-icons'
          }
          if (id.includes('react') || id.includes('react-dom')) {
            return 'vendor-react'
          }

          return undefined
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})

