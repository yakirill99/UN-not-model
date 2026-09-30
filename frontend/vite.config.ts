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
    proxy: Object.fromEntries(
      ['/api', '/healthz', '/readyz', '/openapi.json', '/docs'].map((p) => [
        p,
        { target: api, changeOrigin: true },
      ]),
    ),
  },
})
