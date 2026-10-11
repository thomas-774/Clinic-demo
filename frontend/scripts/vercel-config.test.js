import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { securityHeaders } from '../vite.config.js'

// vercel.json (D-12): the static build, every path served by index.html, and
// the same security headers as `vite preview` (the demo talks to no API).
const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json'), 'utf8'))

describe('vercel.json', () => {
  it('builds the Vite app into dist', () => {
    expect(config).toMatchObject({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist' })
  })

  it('sends every path to index.html, so deep links survive a refresh', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  it('sends the same security headers as vite preview', () => {
    const sent = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]))
    expect(config.headers[0].source).toBe('/(.*)')
    expect(sent).toEqual(securityHeaders(''))
  })
})
