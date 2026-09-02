/// <reference types="vitest/config" />
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { STATIC_SPLASH_ATTR, staticSplashTags } from './src/features/intro/staticSplash'
import { engineChunkHref, enginePreloadScript } from './src/device/enginePreload'
import { site } from './src/content/site'
import {
  LLMS_FILE,
  LLMS_FULL_FILE,
  SITEMAP_FILE,
  headTags,
  jsonLdTag,
  llmsFullTxt,
  llmsTxt,
  noscriptBlock,
  robotsTxt,
  sitemapXml,
} from './src/content/surfaces'

// https://vite.dev/config/
// Served from `/` in dev and on a custom domain; the Pages workflow sets
// BASE_PATH=/grace-city-collective/ so built URLs land under the repo slug.
const base = process.env.BASE_PATH || '/'

// Where the site is published, for every absolute URL a crawler or a share
// card reads (canonical, Open Graph, sitemap, robots): SITE_ORIGIN at build,
// the production domain by default.
const origin = process.env.SITE_ORIGIN || 'https://gracecitycollective.com'

// The intro splash as static markup in index.html, on screen from the first
// paint rather than once the bundle has mounted (src/features/intro/staticSplash.ts).
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

// The engine chunk (three.js + the parallax scene, behind the dynamic import
// in src/engine/index.ts) module-preloaded from the HTML by an inline head
// script, so it downloads alongside the shell — unless the device will take
// the static poster (src/device/enginePreload.ts).
const enginePreload = (): Plugin => ({
  name: 'gcc:engine-preload',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      if (!ctx.filename.endsWith('index.html') || !ctx.bundle) return
      return [
        {
          tag: 'script',
          children: enginePreloadScript(engineChunkHref(ctx.bundle, base)),
          injectTo: 'head',
        },
      ]
    },
  },
})

// The site for readers that do not run JavaScript, generated from the one
// content object (src/content/surfaces.ts): the head tags, the JSON-LD graph
// and the noscript block into index.html — the noscript after the splash and
// before #root — and robots.txt, sitemap.xml, llms.txt and llms-full.txt as
// files at the dist root.
const surfaces = (): Plugin => {
  const opts = { origin, base, splashSelector: `[${STATIC_SPLASH_ATTR}]` }
  const files = () => ({
    'robots.txt': robotsTxt(opts),
    [SITEMAP_FILE]: sitemapXml(opts),
    [LLMS_FILE]: llmsTxt(site, opts),
    [LLMS_FULL_FILE]: llmsFullTxt(site, opts),
  })
  return {
    name: 'gcc:surfaces',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename.endsWith('index.html')) return
        const root = '<div id="root">'
        if (!html.includes(root)) throw new Error(`gcc:surfaces: no ${root} in index.html to put the noscript block before`)
        return {
          html: html.replace(root, `${noscriptBlock(site, opts)}${root}`),
          tags: [...headTags(site, opts), jsonLdTag(site, opts)],
        }
      },
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(files())) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), staticSplash(), surfaces(), enginePreload()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // dist/.vite/manifest.json: the static byte budget (tools/perf/budget.mjs)
    // reads it to find the shell and engine chunks, the css and each hashed
    // texture and font without guessing at file names
    manifest: true,
    // the Doré textures ship as hashed files whatever their size (#97): a
    // 150-byte mask pack inlined as a data URI would sit in the JS bundle
    // and never in the tier's cache; the avif twins (#101) likewise
    assetsInlineLimit: (file) => (/\.(webp|avif)$/.test(file) ? false : undefined),
  },
  test: {
    // Two projects (#103). `pnpm test` runs the unit project against src/;
    // `pnpm test:build` runs the build project against dist/ after a build
    // (tools/README.md). Neither includes the other's files.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}', 'tools/perf/*.test.mjs'],
          exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'build',
          environment: 'node',
          include: ['tests/build/**/*.test.ts'],
          globalSetup: ['./tests/build/globalSetup.ts'],
        },
      },
    ],
  },
})
