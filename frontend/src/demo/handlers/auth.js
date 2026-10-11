import { nowLocal, toIso } from '../clock'
import * as db from '../db'
import { invalid, json, resource } from '../http'
import { translate } from '../lang'
import * as resources from '../resources'
import { phoneRules, normalizePhone } from '../rules'
import { unique, validate } from '../validate'

/** A Sanctum-like plain-text token: "<id>|<40 random characters>". */
function createToken(user) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(40))
  const secret = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  const row = db.insert('tokens', { user_id: user.id, name: 'api', token: '', last_used_at: null })
  row.token = `${row.id}|${secret}`
  return row.token
}

const tokenResponse = (ctx, user, message, status = 200) =>
  resource(resources.authToken(user, createToken(user)), translate(ctx.locale, message), status)

/** GET /health */
export const health = () => json({ status: 'ok', time: toIso(nowLocal()), demo: true })

/** POST /auth/register: patient sign-up (FR-A.1). */
export function register(ctx) {
  const input = normalizePhone({ ...ctx.input })
  const data = validate(ctx, input, {
    name: ['required', 'string', 'max:120'],
    phone: ['required', ...phoneRules()],
    email: ['nullable', 'string', 'email', 'max:150', unique('users', 'email')],
    password: ['required', 'string', 'confirmed', 'min:8', 'max:128'],
    address: ['required', 'string', 'max:255'],
  })
  const user = db.insert('users', {
    name: data.name,
    phone: data.phone,
    email: data.email ?? null,
    password: data.password,
    role: 'patient',
    is_active: true,
  })
  db.insert('patients', { user_id: user.id, address: data.address, date_of_birth: null, gender: null, current_illness: null })
  return tokenResponse(ctx, user, 'Account created.', 201)
}

/** POST /auth/login: phone or email + password (FR-A.2). */
export function login(ctx) {
  const input = { ...ctx.input }
  // Phone numbers may be typed with spaces or dashes.
  if (typeof input.login === 'string' && !input.login.includes('@')) input.login = input.login.replace(/[\s-]/g, '')
  const data = validate(
    ctx,
    input,
    { login: ['required', 'string', 'max:150'], password: ['required', 'string'] },
    { attributes: { login: 'phone or email' } },
  )
  const column = data.login.includes('@') ? 'email' : 'phone'
  const wanted = data.login.toLowerCase()
  const user = db.first('users', (row) => String(row[column] ?? '').toLowerCase() === wanted)
  // A deactivated account gets the same answer as a wrong password (FR-I.1).
  if (!user || user.password !== data.password || !user.is_active) {
    invalid(ctx, { login: translate(ctx.locale, 'auth.failed') })
  }
  return tokenResponse(ctx, user, 'Logged in.')
}

/** POST /auth/logout: revokes the token of this request (FR-A.3). */
export function logout(ctx) {
  db.remove('tokens', ctx.token.id)
  return json({ data: null, message: translate(ctx.locale, 'Logged out.') })
}

/** GET /me */
export const me = (ctx) => resource(resources.user(ctx.user))
