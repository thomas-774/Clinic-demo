import * as db from './db'
import { HttpError, abort } from './http'
import { pickLocale } from './lang'
import { routes } from './routes'

/**
 * The fake backend's front door: (method, url, query, body, headers) →
 * { status, data, headers }, like the source API's routes/api.php plus its
 * middleware (TrimStrings, ConvertEmptyStringsToNull, SetLocale,
 * auth:sanctum, role). Errors come back as responses with their status, so
 * the adapter can turn them into axios errors.
 */

/** Fields TrimStrings leaves alone. */
const UNTRIMMED = ['password', 'password_confirmation', 'current_password']

/** TrimStrings + ConvertEmptyStringsToNull, recursively. */
export function cleanInput(value, key = '') {
  if (typeof value === 'string') {
    const text = UNTRIMMED.includes(key) ? value : value.trim()
    return text === '' ? null : text
  }
  if (Array.isArray(value)) return value.map((item) => cleanInput(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanInput(v, k)]))
  }
  return value
}

/** "/doctor/patients/:patient" → a matcher returning { patient: "5" } or null. */
function compile(path) {
  const names = []
  const pattern = new RegExp(
    `^${path.replace(/\/:([a-zA-Z]+)/g, (_, name) => {
      names.push(name)
      return '/([^/]+)'
    })}/?$`,
  )
  return (actual) => {
    const match = pattern.exec(actual)
    return match ? Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1])])) : null
  }
}

const table = routes.map((route) => ({ ...route, match: compile(route.path) }))

function header(headers, name) {
  const wanted = name.toLowerCase()
  const key = Object.keys(headers ?? {}).find((k) => k.toLowerCase() === wanted)
  return key ? headers[key] : undefined
}

/** The user behind "Authorization: Bearer <token>", or null. Deactivated accounts' tokens stop working (FR-I.1). */
function authenticate(headers) {
  const match = /^Bearer\s+(.+)$/i.exec(header(headers, 'Authorization') ?? '')
  if (!match) return { user: null, token: null }
  const token = db.first('tokens', { token: match[1].trim() })
  const user = token ? db.find('users', token.user_id) : null
  return user?.is_active ? { user, token } : { user: null, token: null }
}

/**
 * @param {{ method: string, path: string, query?: object, body?: unknown, headers?: object, baseUrl?: string }} request
 * @returns {{ status: number, data: unknown, headers: object }}
 */
export function handle({ method, path, query = {}, body, headers = {}, baseUrl = '' }) {
  const verb = method.toUpperCase()
  const ctx = {
    method: verb,
    path,
    baseUrl,
    rawQuery: Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])),
    locale: pickLocale(header(headers, 'Accept-Language')),
    userAgent: header(headers, 'User-Agent') ?? (typeof navigator === 'undefined' ? null : navigator.userAgent),
    ip: '127.0.0.1',
    params: {},
  }
  ctx.query = cleanInput(ctx.rawQuery)
  ctx.body = cleanInput(body && typeof body === 'object' ? body : {})
  // $request->all(): the query string and the body together.
  ctx.input = { ...ctx.query, ...ctx.body }

  try {
    const candidates = table.filter((route) => route.match(path))
    if (!candidates.length) abort(ctx, 404)
    const route = candidates.find((r) => r.method === verb)
    if (!route) abort(ctx, 405)
    ctx.params = route.match(path)

    if (route.auth !== false) {
      Object.assign(ctx, authenticate(headers))
      if (!ctx.user) abort(ctx, 401)
      // EnsureRole runs before route-model binding: the wrong role gets 403, never 404.
      if (route.roles && !route.roles.includes(ctx.user.role)) abort(ctx, 403)
    }

    const run = () => route.handler(ctx)
    const response = verb === 'GET' ? run() : db.transaction(run)
    return { headers: { 'content-type': 'application/json' }, ...response }
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, data: error.data, headers: { 'content-type': 'application/json', ...error.headers } }
    throw error
  }
}
