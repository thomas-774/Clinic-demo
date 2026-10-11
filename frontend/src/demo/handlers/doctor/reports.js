import { today, toIso } from '../../clock'
import * as db from '../../db'
import { json, paginate } from '../../http'
import * as reports from '../../services/reports'
import { remaining } from '../../services/payments'
import { money } from '../../money'
import { oneOf, validate } from '../../validate'

/** Doctor → reports (ReportController, ReportService): money by visit date. */

const PER_PAGE = 20

/** GET /doctor/reports/summary?period=day|week|month (FR-H.1, FR-H.2) */
export function summary(ctx) {
  const { period } = validate(ctx, ctx.input, { period: ['required', oneOf(['day', 'week', 'month'], 'in')] })
  const [from, to] = reports.period(period)
  return json({
    data: { period, from, to, visits: reports.visitsCount(from, to), revenue: reports.revenue(from, to), outstanding: reports.outstanding() },
    message: null,
  })
}

/** ReportService::paymentRow(): paid = this payment, remaining = what the visit still owes now. */
function paymentRow(payment) {
  const visit = db.find('visits', payment.visit_id)
  const patient = db.find('patients', visit.patient_id)
  return {
    id: payment.id,
    paid_at: toIso(payment.paid_at),
    patient_id: visit.patient_id,
    patient_name: db.find('users', patient.user_id).name,
    visit_id: visit.id,
    visit_date: visit.visit_date,
    visit_total: money(visit.total_amount),
    paid: money(payment.amount),
    remaining: remaining(visit),
    recorded_by_name: payment.recorded_by ? (db.find('users', payment.recorded_by)?.name ?? null) : null,
  }
}

/** GET /doctor/reports/payments?from=&to=: 20 per page, with the whole range's totals in meta (FR-H.3). */
export function payments(ctx) {
  const range = validate(ctx, ctx.input, { from: ['nullable', 'date_format:Y-m-d'], to: ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'] })
  const from = range.from ?? today()
  const to = range.to ?? from
  return paginate(ctx, reports.payments(from, to), paymentRow, {
    perPage: PER_PAGE,
    // "range", not from/to: the paginator already uses meta.from / meta.to for row numbers.
    extraMeta: { range: { from, to }, totals: reports.paymentTotals(from, to) },
  })
}

/** GET /doctor/reports/outstanding: every patient who still owes, largest first, with the total. */
export const outstanding = () => json({ data: reports.outstandingByPatient(), meta: { total: reports.outstanding() }, message: null })

/** GET /doctor/reports/daily-revenue?month=YYYY-MM: one row per day (FR-H.4); this month by default. */
export function dailyRevenue(ctx) {
  const data = validate(ctx, ctx.input, { month: ['nullable', 'date_format:Y-m'] })
  const month = data.month ?? today().slice(0, 7)
  return json({ data: reports.dailyRevenue(month), meta: { month }, message: null })
}
