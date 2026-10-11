/**
 * Clinic time (Africa/Cairo) for the fake backend. Like MySQL in the source
 * app, the demo DB stores date-times as Cairo wall-clock strings
 * "YYYY-MM-DD HH:MM:SS", so they compare correctly as plain strings. The API
 * sends them as ISO 8601 with the Cairo offset ("2026-10-06T17:00:00+03:00").
 *
 * Days are "YYYY-MM-DD" strings and day maths never goes through a local
 * Date, because Cairo's DST starts at midnight.
 */
export const CLINIC_TIME_ZONE = 'Africa/Cairo'

const wallClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const pad = (n) => String(n).padStart(2, '0')

/** Milliseconds since the epoch → "YYYY-MM-DD HH:MM:SS" in Cairo. */
export function toLocal(ms) {
  const parts = Object.fromEntries(wallClock.formatToParts(new Date(ms)).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

/** The wall-clock string read as if it were UTC, in ms (no time zone shift). */
function localAsUtc(local) {
  const [date, time = '00:00:00'] = local.split(' ')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi, s = 0] = time.split(':').map(Number)
  return Date.UTC(y, mo - 1, d, h, mi, s)
}

/** Cairo's offset from UTC at instant `ms`, in minutes (120 or 180). */
function offsetAt(ms) {
  return Math.round((localAsUtc(toLocal(ms)) - Math.floor(ms / 1000) * 1000) / 60000)
}

/** "YYYY-MM-DD HH:MM:SS" in Cairo → ms since the epoch. */
export function fromLocal(local) {
  const guess = localAsUtc(local)
  const first = guess - offsetAt(guess) * 60000
  return guess - offsetAt(first) * 60000
}

/** Cairo wall-clock string → "2026-10-06T17:00:00+03:00" (null stays null). */
export function toIso(local) {
  if (!local) return null
  const minutes = offsetAt(fromLocal(local))
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${local.replace(' ', 'T')}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** Any date-time the browser sends (ISO with an offset or Z) → Cairo wall-clock string, or null. */
export function parseToLocal(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const text = value.trim()
  // No offset: already clinic time (Laravel reads it in the app time zone).
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    const [date, time] = text.split(/[T ]/)
    return `${date} ${time.length === 5 ? `${time}:00` : time}`
  }
  const ms = Date.parse(text)
  return Number.isNaN(ms) ? null : toLocal(ms)
}

/** Now as a Cairo wall-clock string. */
export const nowLocal = (ms = Date.now()) => toLocal(ms)

/** Today in Cairo as "YYYY-MM-DD". */
export const today = (ms = Date.now()) => toLocal(ms).slice(0, 10)

/** "YYYY-MM-DD" + n days. */
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "YYYY-MM-DD" − n months, clamped to the month's last day (like Carbon's subMonthsNoOverflow). */
export function subMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 - months, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(d, last))}`
}

/** "YYYY-MM-DD" − n years (29 Feb → 28 Feb). */
export const subYears = (date, years) => subMonths(date, years * 12)

/** 0 = Sunday … 6 = Saturday, like working_hours.day_of_week. */
export function dayOfWeek(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function diffDays(from, to) {
  return Math.round((localAsUtc(to) - localAsUtc(from)) / 86400000)
}

/** Cairo wall-clock string + n minutes (on the wall clock, which is what slot maths needs). */
export function addMinutes(local, minutes) {
  const ms = localAsUtc(local) + minutes * 60000
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

/** "17:00" / "17:00:00" → minutes after midnight. */
export function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 1020 → "17:00:00". */
export const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`
