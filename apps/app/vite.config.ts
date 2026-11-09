/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Reported with usage events and errors so they can be grouped by release. Netlify sets
// COMMIT_REF during a deploy; local builds only carry the package version.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }
const commit = (process.env.COMMIT_REF ?? '').slice(0, 7)
const appVersion = commit ? `${pkg.version}+${commit}` : pkg.version

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  test: {
    // Safety rail: the unit suite must never be able to reach a live Supabase
    // project. These values satisfy `isSupabaseConfigured` so modules load, but
    // point at an unroutable loopback port; any unmocked request fails fast.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:9',
      VITE_SUPABASE_ANON_KEY: 'test-only-anon-key-not-a-real-credential',
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
