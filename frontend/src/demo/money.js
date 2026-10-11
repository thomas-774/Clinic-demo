/**
 * Money in whole piastres (PR-6). Amounts are stored and sent as strings with
 * two decimals ("1500.00"), like MySQL DECIMAL(10,2) through Laravel; every
 * sum and comparison is done on integers, so 0.10 + 0.20 is exactly 0.30.
 */

/** "1500" / 1500 / 1500.5 / "1500.50" / null → piastres (PaymentService::money). */
export function toPiastres(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Math.round(Number(value.toFixed(2)) * 100)
  const text = String(value).trim()
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match) return 0
  const [, sign, pounds, fraction = ''] = match
  // bcadd truncates past the scale; validation allows two decimals at most anyway.
  const piastres = Number(pounds || 0) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
  return sign === '-' ? -piastres : piastres
}

/** 150050 → "1500.50" */
export function fromPiastres(piastres) {
  const sign = piastres < 0 ? '-' : ''
  const abs = Math.abs(piastres)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Any amount → "1500.50" */
export const money = (value) => fromPiastres(toPiastres(value))
