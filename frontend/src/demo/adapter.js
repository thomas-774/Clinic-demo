import { AxiosError, AxiosHeaders, CanceledError } from 'axios'

/**
 * An axios adapter that answers from the fake backend instead of the
 * network. The backend (router, handlers, seed data) is loaded on the first
 * request, so it is a chunk of its own and never weighs on the first page.
 *
 * Each answer waits 150–300 ms, so loading states still show (none in tests).
 */
const DELAY = import.meta.env.MODE === 'test' ? { min: 0, max: 0 } : { min: 150, max: 300 }

let backend = null
const loadBackend = () => (backend ??= import('./router'))

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CanceledError())
    if (ms <= 0) return resolve()
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer)
      reject(new CanceledError())
    })
  })
}

/** The API path of a request: "/doctor/patients/5", without the origin, the base path or the query. */
export function apiPath(url = '', baseURL = '') {
  const base = new URL(baseURL || '/', 'http://demo.invalid')
  const full = new URL(url, `http://demo.invalid${base.pathname.replace(/\/?$/, '/')}`)
  const prefix = base.pathname.replace(/\/$/, '')
  let path = full.pathname
  if (prefix && path.startsWith(`${prefix}/`)) path = path.slice(prefix.length)
  // Without VITE_API_URL the client may still be given /api/v1 paths.
  path = path.replace(/^\/api\/v1(?=\/)/, '')
  return { path, query: Object.fromEntries(full.searchParams) }
}

function parseBody(data) {
  if (typeof data !== 'string') return data ?? {}
  try {
    return JSON.parse(data)
  } catch {
    return {}
  }
}

/** @param {import('axios').InternalAxiosRequestConfig} config */
export async function demoAdapter(config) {
  const { path, query: urlQuery } = apiPath(config.url, config.baseURL)
  const headers = AxiosHeaders.from(config.headers).toJSON()
  await wait(DELAY.min + Math.random() * (DELAY.max - DELAY.min), config.signal)

  const { handle } = await loadBackend()
  const result = handle({
    method: config.method ?? 'get',
    path,
    query: { ...urlQuery, ...config.params },
    body: parseBody(config.data),
    headers,
    baseUrl: config.baseURL ?? '',
  })

  let data = result.data
  if (config.responseType === 'blob' && !(data instanceof Blob)) {
    data = new Blob([typeof data === 'string' ? data : JSON.stringify(data)], { type: result.headers?.['content-type'] ?? 'application/json' })
  }

  const response = {
    data,
    status: result.status,
    statusText: String(result.status),
    headers: AxiosHeaders.from(result.headers ?? {}),
    config,
    request: { responseURL: path },
  }

  const validate = config.validateStatus ?? ((status) => status >= 200 && status < 300)
  if (!validate(response.status)) {
    throw new AxiosError(
      `Request failed with status code ${response.status}`,
      response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      response.request,
      response,
    )
  }
  return response
}
