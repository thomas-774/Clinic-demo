import * as audit from '../audit'
import { nowLocal } from '../clock'
import * as db from '../db'
import { invalid } from '../http'
import { translate } from '../lang'
import { fromPiastres, toPiastres } from '../money'

/**
 * PaymentService (PR-1 … PR-6): paid, remaining and payment status of a
 * visit are never stored; they are computed from its payments, in piastres.
 */

export const paymentsOf = (visit) => db.where('payments', { visit_id: visit.id })

/** Sum of the visit's payments, in piastres. */
export const paidPiastres = (visit) => paymentsOf(visit).reduce((sum, payment) => sum + toPiastres(payment.amount), 0)

/** PR-1: remaining = total − paid, in piastres. */
export const remainingPiastres = (visit) => toPiastres(visit.total_amount) - paidPiastres(visit)

export const paid = (visit) => fromPiastres(paidPiastres(visit))
export const remaining = (visit) => fromPiastres(remainingPiastres(visit))

/** PR-3: paid when nothing remains, unpaid when nothing was paid, else partially paid. */
export function status(visit) {
  if (remainingPiastres(visit) <= 0) return 'paid'
  if (paidPiastres(visit) === 0) return 'unpaid'
  return 'partially_paid'
}

/** FR-D.7: sum of remaining over these visits. */
export const sumRemaining = (visits) => fromPiastres(visits.reduce((sum, visit) => sum + remainingPiastres(visit), 0))

/** PR-2: a payment is more than zero and at most the remaining amount. */
export function assertPaymentAllowed(ctx, visit, amount, field = 'amount') {
  const piastres = toPiastres(amount)
  if (piastres <= 0) invalid(ctx, { [field]: translate(ctx.locale, 'The payment must be more than zero.') })
  const left = remainingPiastres(visit)
  if (piastres > left) {
    invalid(ctx, { [field]: translate(ctx.locale, 'The payment cannot be more than the remaining :amount EGP.', { amount: fromPiastres(left) }) })
  }
}

/** PR-2: the total can never be lower than what has already been paid. */
export function assertTotalAllowed(ctx, visit, total) {
  const already = paidPiastres(visit)
  if (toPiastres(total) < already) {
    invalid(ctx, { total_amount: translate(ctx.locale, 'The total cannot be lower than the :amount EGP already paid.', { amount: fromPiastres(already) }) })
  }
}

/** An installment (FR-D.6), recorded by the doctor or the assistant (FR-I.5). */
export function addPayment(ctx, visit, amount, method = 'cash', paidAt = null) {
  assertPaymentAllowed(ctx, visit, amount)
  return audit.create(ctx, 'payments', {
    visit_id: visit.id,
    amount: fromPiastres(toPiastres(amount)),
    method,
    paid_at: paidAt ?? nowLocal(),
    recorded_by: ctx.user?.id ?? null,
  })
}
