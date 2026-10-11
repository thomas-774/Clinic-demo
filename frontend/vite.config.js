import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * The SPA's security headers (NFR-S.1, T11-01). Nginx sends the same ones in
 * production (T7-05), where the API is on the same origin; `vite preview` adds
 * the API's origin to connect-src so the built app can be checked locally.
 */
function securityHeaders(apiUrl) {
  const api = apiUrl ? new URL(apiUrl).origin : ''
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'", // Cairo is self-hosted since T11-14
    "img-src 'self' data:",
    `connect-src 'self' ${api}`.trim(),
    "frame-ancestors 'none'",
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  // dist/.vite/manifest.json: which chunks each page needs, read by scripts/check-bundle-size.js (NFR-P.4).
  build: { manifest: true },
  preview: { port: 4173, strictPort: true, headers: securityHeaders(loadEnv(mode, process.cwd()).VITE_API_URL) },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads', // the default forks pool times out on Windows paths containing spaces
    setupFiles: './src/test/setup.js',
    // NFR-Q.2 (T11-11): `npm run test:coverage` fails under these numbers.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**'],
      reporter: ['text-summary', 'html'],
      thresholds: {
        lines: 70,
        branches: 60,
        'src/utils/**': { lines: 85, branches: 85, functions: 85, statements: 85 },
        'src/hooks/**': { lines: 85, branches: 85, functions: 85, statements: 85 },
      },
    },
  },
}))
