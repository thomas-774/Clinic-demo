import * as db from '../db'
import { abort } from '../http'
import { translate } from '../lang'

/** Route-model binding: the row for route parameter `param`, or 404. */
export function bind(ctx, table, param) {
  const row = db.find(table, ctx.params[param])
  if (!row) abort(ctx, 404)
  return row
}

/** __() in the request's language. */
export const __ = (ctx, key, values) => translate(ctx.locale, key, values)

/** $request->boolean(): true for true, 1, "1", "true", "on", "yes". */
export const boolean = (value) => [true, 1, '1', 'true', 'on', 'yes'].includes(typeof value === 'string' ? value.toLowerCase() : value)

/** Only the keys of `data` that were sent ($request->safe()->only()). */
export const only = (data, keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]))

/** Letters and digits that cannot be confused when read out over the phone (InitialPassword). */
export function initialPassword(length = 8) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => alphabet[b % alphabet.length]).join('')
}

const nameOrder = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

/** The patient list order: by name, then by user id (Patient::scopeForList). */
export function byPatientName(a, b) {
  const ua = db.find('users', a.user_id)
  const ub = db.find('users', b.user_id)
  return nameOrder.compare(ua.name, ub.name) || ua.id - ub.id
}

/** Name or phone contains `search`, case-insensitive (LIKE %search%). */
export function patientMatches(patient, search) {
  if (!search) return true
  const account = db.find('users', patient.user_id)
  const needle = search.toLowerCase()
  return account.name.toLowerCase().includes(needle) || account.phone.toLowerCase().includes(needle)
}
