import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// import sentryVitePlugin from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // sentryVitePlugin({
    //   org: import.meta.env.SENTRY_ORG || 'mongez',
    //   project: import.meta.env.SENTRY_PROJECT || 'frontend',
    //   authToken: import.meta.env.SENTRY_AUTH_TOKEN,
    //   sourcemaps: {
    //     filesToDeleteAfterUpload: ['**/*.map'],
    //   },
    // }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
