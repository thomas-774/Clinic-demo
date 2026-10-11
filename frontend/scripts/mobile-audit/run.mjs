// Mobile-first check of the five patient pages (NFR-U.2, NFR-P.5, T11-14),
// in Arabic and English:
//   - at 360 px with phone emulation: no sideways scroll, no clipped text,
//     tap targets >= 44 x 44 px, inputs >= 16 px; a full-page screenshot each,
//   - Lighthouse mobile (its default: Moto G Power, Slow 4G, simulated
//     throttling) with a cold cache: Performance, Accessibility and Best
//     Practices >= 90, LCP < 2.5 s, CLS < 0.1.
// The production build is served the way the real host does it (HTTPS with
// HTTP/2, gzip, long-lived /assets cache; a throwaway self-signed certificate
// from openssl) and the API is answered from the a11y-audit
// fixtures by the same server, so Lighthouse's own tab gets them too. No
// backend and no real account: the patient's "token" is a dummy string.
//
//   npm run mobile:audit -- [--only=<text>] [--build=no] [--lighthouse=no] [--out=<dir>]
//   EDGE_PATH=... to use another Chromium-based browser.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createSecureServer } from 'node:http2'
import { tmpdir } from 'node:os'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { answer, connect, waitFor } from '../a11y-audit/run.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')))
// HTTPS + HTTP/2 like production (T7-05): over HTTP/1.1 Lighthouse would model
// six connections, each with its own handshake, which no real visitor pays.
const PORT = 4175
const ORIGIN = `https://localhost:${PORT}`
const CDP_PORT = 9335
const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const DIST = join(root, 'dist-mobile')
const OUT = args.out ?? join(root, 'mobile-audit')
const TOKEN = 'mobile-audit'
const LIGHTHOUSE = 'lighthouse@13.5.0'

/** [role, path, name]: the five pages of NFR-U.2. */
export const PAGES = [
  ['public', '/login', 'Login'],
  ['public', '/register', 'Register'],
  ['patient', '/patient', 'Patient home'],
  ['patient', '/patient/book', 'Book'],
  ['patient', '/patient/appointments', 'My appointments'],
]

/** Budgets (NFR-U.2 / NFR-P.5). */
const MIN_TARGET = 44
const MIN_INPUT_FONT = 16
const MIN_SCORE = 90
const MAX_LCP = 2500
const MAX_CLS = 0.1

const LOADING = { ar: 'جارٍ التحميل…', en: 'Loading…' }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' }

/** An upcoming, still cancellable appointment, so the Cancel button is on the page. */
function withUpcoming(body, path) {
  const start = new Date(Date.now() + 3 * 864e5)
  start.setUTCHours(15, 0, 0, 0)
  const end = new Date(start.getTime() + 15 * 6e4)
  const upcoming = { id: 1, start_at: start.toISOString(), end_at: end.toISOString(), status: 'booked', checked_in_at: null, cancelled_at: null, can_cancel: true }
  if (path === '/patient/appointments') return { ...body, data: { ...body.data, upcoming: [upcoming] } }
  if (path === '/patient/profile') return { ...body, data: { ...body.data, next_appointment: upcoming } }
  return body
}

/** Runs a shell command without blocking; resolves with its exit code. */
const run = (command) =>
  new Promise((resolve) => spawn(command, { cwd: root, shell: true, stdio: 'inherit' }).on('exit', resolve))

/** A throwaway self-signed certificate for localhost (Edge runs with --allow-insecure-localhost). */
function certificate(dir) {
  const [key, cert] = [join(dir, 'key.pem'), join(dir, 'cert.pem')]
  const made = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' })
  if (made.status !== 0) throw new Error('openssl is needed for the HTTPS test server')
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

/** Static build + fixture API over HTTP/2, compressed and cached like production. */
function serve(tls) {
  const server = createSecureServer({ ...tls, allowHTTP1: true }, (request, response) => {
    const url = new URL(request.url, ORIGIN)
    if (url.pathname.startsWith('/api/v1/')) {
      const role = (request.headers.authorization ?? '').includes(TOKEN) ? 'patient' : 'public'
      let body = answer(role, request.method, url.href)
      if (body && role === 'patient') body = withUpcoming(body, url.pathname.replace('/api/v1', ''))
      response.writeHead(body ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
      response.end(JSON.stringify(body ?? { message: 'Not in the audit fixtures.' }))
      return
    }
    let file = join(DIST, normalize(url.pathname).replace(/^([\\/]\.\.)+/, ''))
    if (!existsSync(file) || !extname(file)) file = join(DIST, 'index.html') // SPA fallback
    let data = readFileSync(file)
    const headers = {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    }
    if (/text|javascript|json|svg/.test(headers['Content-Type']) && /gzip/.test(request.headers['accept-encoding'] ?? '')) {
      data = gzipSync(data)
      headers['Content-Encoding'] = 'gzip'
    }
    response.writeHead(200, headers)
    response.end(data)
  })
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)))
}

/** Layout checks inside the page at 360 px. */
const LAYOUT_CHECK = `(() => {
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' }
  const label = (e) => (e.tagName.toLowerCase() + ' "' + (e.getAttribute('aria-label') || e.innerText || e.value || e.name || '').trim().replace(/\\s+/g, ' ').slice(0, 30) + '"')
  const extra = document.documentElement.scrollWidth - document.documentElement.clientWidth
  const targets = [...document.querySelectorAll('a[href], button, input, select, textarea, [role=radio]')].filter(visible)
  const small = targets.map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width < ${MIN_TARGET} - 0.5 || r.height < ${MIN_TARGET} - 0.5)
    .map(({ e, r }) => label(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))
  const smallText = [...document.querySelectorAll('input, select, textarea')].filter(visible)
    .filter((e) => parseFloat(getComputedStyle(e).fontSize) < ${MIN_INPUT_FONT}).map(label)
  // Clipped: a box narrower than its content that neither scrolls nor wraps it.
  const clipped = [...document.querySelectorAll('body *')].filter(visible).filter((e) => {
    const s = getComputedStyle(e)
    return e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(s.overflowX) && !e.classList.contains('sr-only')
  }).map(label)
  // Past the screen edge (either side, for RTL) and not inside a scrolling box.
  const scrolls = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true } return false }
  const outside = [...document.querySelectorAll('body *')].filter(visible).filter((e) => {
    const r = e.getBoundingClientRect()
    return (r.right > innerWidth + 1 || r.left < -1) && !scrolls(e) && getComputedStyle(e).position !== 'fixed'
  }).map(label).slice(0, 5)
  const dayRow = document.querySelector('[role=radiogroup]')
  return {
    extra, small, smallText, clipped, outside, targets: targets.length,
    dayRow: dayRow ? { scrolls: dayRow.scrollWidth > dayRow.clientWidth, overflowX: getComputedStyle(dayRow).overflowX } : null,
  }
})()`

async function main() {
  if (args.build !== 'no') {
    const built = spawnSync('npx vite build --outDir dist-mobile', { cwd: root, shell: true, stdio: 'inherit', env: { ...process.env, VITE_API_URL: `${ORIGIN}/api/v1` } })
    if (built.status !== 0) throw new Error('vite build failed')
  }
  mkdirSync(OUT, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'mobile-edge-'))
  const server = await serve(certificate(profile))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--allow-insecure-localhost', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
  const results = []
  let cdp

  try {
    let version
    await waitFor(async () => {
      version = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`).then((r) => r.json(), () => null)
      return Boolean(version)
    })
    cdp = await connect(version.webSocketDebuggerUrl)
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    const send = (method, params) => cdp.send(method, params, sessionId)
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value
    await send('Page.enable')
    await send('Network.enable')

    /** localStorage of the origin, shared with Lighthouse's tab (same profile). */
    const signIn = async (role, language) => {
      await send('Page.navigate', { url: `${ORIGIN}/favicon.svg` })
      await sleep(300)
      await evaluate(`localStorage.setItem('clinic.lang', '${language}'); ${role === 'public' ? "localStorage.removeItem('clinic.token')" : `localStorage.setItem('clinic.token', '${TOKEN}')`}`)
    }

    for (const [role, path, name] of PAGES) {
      if (args.only && !`${name} ${path}`.toLowerCase().includes(args.only.toLowerCase())) continue
      for (const language of ['ar', 'en']) {
        const slug = `${name.toLowerCase().replace(/\W+/g, '-')}-${language}`
        await signIn(role, language)

        // 1) A phone: 360 px wide, touch, DPR 2.
        await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 780, deviceScaleFactor: 2, mobile: true })
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
        await send('Page.navigate', { url: ORIGIN + path })
        const loaded = await waitFor(() => evaluate(`!!document.querySelector('h1') && !document.body.innerText.includes(${JSON.stringify(LOADING[language])})`))
        await sleep(800)
        const layout = await evaluate(LAYOUT_CHECK)
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
        writeFileSync(join(OUT, `${slug}.png`), Buffer.from(shot.data, 'base64'))
        let dialog = null
        if (path === '/patient/book') {
          await evaluate(`document.querySelector('[role=group] button')?.click()`)
          await sleep(400)
          dialog = await evaluate(LAYOUT_CHECK)
          const sheet = await send('Page.captureScreenshot', { format: 'png' })
          writeFileSync(join(OUT, `${slug}-dialog.png`), Buffer.from(sheet.data, 'base64'))
        }
        await send('Emulation.setTouchEmulationEnabled', { enabled: false })
        await send('Emulation.clearDeviceMetricsOverride')

        // 2) Lighthouse mobile in its own tab, cold cache, our localStorage kept.
        let lighthouse = null
        if (args.lighthouse !== 'no') {
          const report = join(OUT, `${slug}.lighthouse.json`)
          // Our tab idles meanwhile; Lighthouse in headless Edge still fails now and then (CDP timeout, NO_FCP), hence the retries.
          await send('Page.navigate', { url: 'about:blank' })
          let status
          for (let attempt = 0; attempt < 3 && status !== 0; attempt++) {
            if (attempt) await sleep(2000)
            rmSync(report, { force: true })
            await send('Network.clearBrowserCache')
            // Async: the API above is served by this very process, so its event loop must keep running.
            status = await run(
              `npx -y ${LIGHTHOUSE} "${ORIGIN + path}" --port=${CDP_PORT} --disable-storage-reset --only-categories=performance,accessibility,best-practices --output=json --output-path="${report}" ${args.verbose ? '--verbose' : '--quiet'} --locale=en`,
            )
          }
          if (status === 0 && existsSync(report)) {
            const lhr = JSON.parse(readFileSync(report, 'utf8'))
            const score = (id) => Math.round((lhr.categories[id]?.score ?? 0) * 100)
            lighthouse = {
              performance: score('performance'),
              accessibility: score('accessibility'),
              bestPractices: score('best-practices'),
              lcp: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
              cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
              failed: Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary').map((a) => a.id),
              finalUrl: lhr.finalDisplayedUrl,
            }
          }
        }

        const entry = { page: name, path, language, loaded, layout, dialog, lighthouse }
        const problems = [
          !loaded && 'did not load',
          layout.extra > 1 && `scrolls sideways ${layout.extra}px`,
          layout.small.length && `small targets: ${layout.small.join(', ')}`,
          layout.smallText.length && `inputs under 16px: ${layout.smallText.join(', ')}`,
          layout.clipped.length && `clipped: ${layout.clipped.join(', ')}`,
          layout.outside.length && `past the edge: ${layout.outside.join(', ')}`,
          dialog && dialog.small.length && `dialog small targets: ${dialog.small.join(', ')}`,
          lighthouse && lighthouse.performance < MIN_SCORE && `performance ${lighthouse.performance}`,
          lighthouse && lighthouse.accessibility < MIN_SCORE && `accessibility ${lighthouse.accessibility}`,
          lighthouse && lighthouse.bestPractices < MIN_SCORE && `best practices ${lighthouse.bestPractices}`,
          lighthouse && lighthouse.lcp >= MAX_LCP && `LCP ${lighthouse.lcp}ms`,
          lighthouse && lighthouse.cls >= MAX_CLS && `CLS ${lighthouse.cls}`,
          args.lighthouse !== 'no' && !lighthouse && 'lighthouse failed',
          lighthouse && lighthouse.finalUrl !== ORIGIN + path && `lighthouse ended on ${lighthouse.finalUrl}`,
        ].filter(Boolean)
        entry.problems = problems
        results.push(entry)
        const lh = lighthouse ? ` · LH perf ${lighthouse.performance} a11y ${lighthouse.accessibility} bp ${lighthouse.bestPractices} LCP ${(lighthouse.lcp / 1000).toFixed(2)}s CLS ${lighthouse.cls}` : ''
        console.log(`${problems.length ? '✗' : '✓'} ${language} ${name.padEnd(16)} ${layout.targets} targets${lh}${problems.length ? `\n    ${problems.join('\n    ')}` : ''}`)
      }
    }
  } finally {
    cdp?.close()
    edge.kill()
    server.close()
    // Edge's launcher exits at once and leaves its renderers; stop every process of this profile.
    if (process.platform === 'win32') {
      spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profile}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`], { stdio: 'ignore' })
    }
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      // a renderer may still hold a file; the OS cleans the temp folder
    }
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1))
  console.log(`\nScreenshots and results: ${OUT}`)
  process.exitCode = results.some((r) => r.problems.length) ? 1 : 0
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main()
