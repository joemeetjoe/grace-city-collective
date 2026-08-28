import path from 'node:path'
import { defineConfig } from 'vite'

// Bundles the content editor's Lambda (infra/editor/handler.ts) into a single
// ESM file for the nodejs22.x runtime. The AWS SDK v3 clients are part of that
// runtime, so they stay external; everything else (the validator in
// src/content) is inlined. `pnpm build:editor` runs this and zips the result.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  ssr: {
    target: 'node',
    noExternal: true,
  },
  build: {
    ssr: 'infra/editor/handler.ts',
    target: 'node22',
    outDir: 'infra/editor/dist',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: false,
    sourcemap: false,
    rolldownOptions: {
      external: [/^@aws-sdk\//],
      output: {
        format: 'es',
        entryFileNames: 'index.mjs',
      },
    },
  },
})
