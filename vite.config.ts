/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { staticSplashTags } from './src/intro/staticSplash'

// https://vite.dev/config/
// Served from `/` in dev and on a custom domain; the Pages workflow sets
// BASE_PATH=/grace-city-collective/ so built URLs land under the repo slug.
const base = process.env.BASE_PATH || '/'

// The intro splash as static markup in index.html, on screen from the first
// paint rather than once the bundle has mounted (src/intro/staticSplash.ts).
// The site only: the editor has no intro.
const staticSplash = (): Plugin => ({
  name: 'gcc:static-splash',
  transformIndexHtml: {
    order: 'pre',
    handler(_html, ctx) {
      if (!ctx.filename.endsWith('index.html')) return
      return staticSplashTags()
    },
  },
})

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), staticSplash()],
  build: {
    rolldownOptions: {
      // two pages: the site, and the content editor at /admin.html
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})
