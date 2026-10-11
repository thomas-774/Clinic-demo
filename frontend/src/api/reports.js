import client from './client'

const data = (res) => res.data.data

/** period = day | week | month → { period, from, to, visits, revenue, outstanding }; money counts on the visit's date. */
export const getReportSummary = (period) => client.get('/doctor/reports/summary', { params: { period } }).then(data)

/**
 * Payments from `from` to `to` (inclusive dates), newest first, 20 per page →
 * { data: rows, meta: { current_page, last_page, total, range, totals: { count, paid, remaining } } }.
 */
export const getReportPayments = ({ from, to, page = 1 }) =>
  client.get('/doctor/reports/payments', { params: { from, to, page } }).then((res) => res.data)

/** month = "YYYY-MM" → [{ date, revenue }] for every day of the month. */
export const getDailyRevenue = (month) => client.get('/doctor/reports/daily-revenue', { params: { month } }).then(data)

/** { data: [{ patient_id, patient_name, phone, outstanding, unpaid_visits, oldest_visit_date }], meta: { total } }, largest balance first. */
export const getOutstanding = () => client.get('/doctor/reports/outstanding').then((res) => res.data)
