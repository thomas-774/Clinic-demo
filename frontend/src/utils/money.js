/**
 * EGP amounts as strings ("1500.00", like the API) and whole piastres for
 * maths, so 0.10 + 0.20 is exactly 0.30 (PR-6). The server's numbers are final.
 */

/** payments.method values (§5.1). */
export const PAYMENT_METHODS = ['cash', 'card', 'wallet']

const MONEY = /^\d+(\.\d{1,2})?$/

/** "1500", "1500.5", "1500.50" → true; "", "-1", "1.234", "1,500" → false. */
export function isMoney(value) {
  return MONEY.test(String(value ?? '').trim())
}

/** "1500.5" → 150050, or NaN when it is not a valid amount. */
export function toPiastres(value) {
  const text = String(value ?? '').trim()
  if (!isMoney(text)) return NaN
  const [pounds, fraction = ''] = text.split('.')
  return Number(pounds) * 100 + Number(fraction.padEnd(2, '0'))
}

/** 50050 → "500.50"; negative amounts keep their sign. */
export function fromPiastres(piastres) {
  const sign = piastres < 0 ? '-' : ''
  const abs = Math.abs(piastres)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
