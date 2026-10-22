/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend in development: `just dev` on :8000. Same-origin in the browser, so the
// httpOnly session cookie set by /api/auth/join just works. Override with ARENA_API_URL.
const api = process.env.ARENA_API_URL ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      ['/api', '/healthz', '/readyz', '/openapi.json', '/docs'].map((p) => [
        p,
        { target: api, changeOrigin: true },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/api/schema.d.ts', 'src/main.tsx', 'src/test/**', '**/*.test.*'],
      thresholds: { lines: 99, statements: 99, functions: 99, branches: 95 },
    },
  },
})
