import i18next from 'i18next'

export const CLINIC_TIME_ZONE = 'Africa/Cairo'

// Latin digits in both languages so dates, prices and phone numbers read the same way.
const LOCALES = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' }

function locale(language) {
  return LOCALES[language ?? i18next.resolvedLanguage] ?? LOCALES.en
}

/** "2026-10-05" → "5 Oct 2026" / "5 أكتوبر 2026". Date-only strings are not shifted by time zone. */
export function formatDate(value, language) {
  if (!value) return ''
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: isDateOnly ? 'UTC' : CLINIC_TIME_ZONE,
  }).format(new Date(isDateOnly ? `${value}T00:00:00Z` : value))
}

/** "2026-10-05" → { weekday: "Mon", day: "5", month: "Oct" } for a day picker. */
export function dayParts(value, language) {
  const parts = new Intl.DateTimeFormat(locale(language), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .formatToParts(new Date(`${value}T00:00:00Z`))
  const part = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return { weekday: part('weekday'), day: part('day'), month: part('month') }
}

/** ISO date-time → "17:45" in clinic time. */
export function formatTime(value, language) {
  if (!value) return ''
  return new Intl.DateTimeFormat(locale(language), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: CLINIC_TIME_ZONE,
  }).format(new Date(value))
}

/** "1500.00" → "EGP 1,500.00" / "1,500.00 ج.م.‏". Amounts arrive as strings (DECIMAL). */
export function formatMoney(amount, language) {
  return new Intl.NumberFormat(locale(language), {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 2,
  }).format(Number(amount ?? 0))
}

/** Today's date in clinic time as "YYYY-MM-DD" (for date inputs). */
export function todayInClinic() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TIME_ZONE }).format(new Date())
}
