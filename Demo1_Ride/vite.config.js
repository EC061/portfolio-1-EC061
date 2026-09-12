import { defineConfig } from 'vite'

// BASE_PATH lets the same source deploy to the root of a container (`/`)
// and to a sub-path on GitHub Pages (`/<repo>/demo1/`).
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // keep three in its own long-lived chunk so app edits do not
        // invalidate a megabyte of engine in the browser cache
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
  server: { host: '0.0.0.0', port: 5173 },
})
