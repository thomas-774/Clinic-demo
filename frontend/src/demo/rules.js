import { unique } from './validate'

/**
 * Rules shared by several requests (app/Http/Requests/Concerns).
 */

/** ValidatesPhone::phoneRules() */
export const phoneRules = (ignoreUserId = null) => ['string', 'max:20', 'regex:/^\\+?\\d{8,15}$/', unique('users', 'phone', ignoreUserId)]

/** ValidatesPhone::normalizePhone(): phones may be typed with spaces or dashes. */
export function normalizePhone(input) {
  if (typeof input.phone === 'string') input.phone = input.phone.replace(/[\s-]/g, '')
  return input
}

/** StoreVisitRequest::moneyRules() */
export const moneyRules = () => ['numeric', 'decimal:0,2', 'min:0', 'max:99999999.99']
