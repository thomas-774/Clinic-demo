import * as db from './db'

/**
 * The source app's API Resources (app/Http/Resources): DB rows → the JSON
 * the frontend reads. Date-times go out as ISO 8601 in Cairo time.
 */

/** UserResource */
export function user(row) {
  const out = { id: row.id, name: row.name, phone: row.phone, email: row.email, role: row.role }
  if (row.role === 'patient') out.patient_id = db.first('patients', { user_id: row.id })?.id ?? null
  return out
}

/** AuthTokenResource */
export const authToken = (row, token) => ({ token, user: user(row) })
