import { addDays, dayOfWeek, today } from '../clock'
import * as db from '../db'
import { fromPiastres, toPiastres } from '../money'
import { remainingPiastres } from './payments'

/**
 * ReportService and Period. Money counts on the VISIT's date: every payment
 * of a visit dated in the period (later installments included) is that
 * period's revenue, and the visits card counts visits, not patients.
 */

/** The clinic week starts on Saturday (config clinic.week_start). */
const WEEK_START = 6

/** Period::for(): [from, to] dates of the day / week / month that contains `date`. */
export function period(name, date = today()) {
  if (name === 'day') return [date, date]
  if (name === 'week') {
    const from = addDays(date, -((dayOfWeek(date) - WEEK_START + 7) % 7))
    return [from, addDays(from, 6)]
  }
  const [y, m] = date.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const month = date.slice(0, 7)
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`]
}

export const visitsBetween = (from, to) => db.where('visits', (v) => v.visit_date >= from && v.visit_date <= to)

/** All payments of the visits dated from `from` to `to`, whenever they were paid. */
export function paymentsOfVisitsBetween(from, to) {
  const ids = new Set(visitsBetween(from, to).map((v) => v.id))
  return db.where('payments', (p) => ids.has(p.visit_id))
}

const sum = (payments) => payments.reduce((total, p) => total + toPiastres(p.amount), 0)

export const revenue = (from, to) => fromPiastres(sum(paymentsOfVisitsBetween(from, to)))

/** Visits dated in the period whose appointment is completed, plus walk-ins. A patient seen twice counts twice. */
export function visitsCount(from, to) {
  return visitsBetween(from, to).filter((v) => v.appointment_id === null || db.find('appointments', v.appointment_id)?.status === 'completed').length
}

/** FR-H.2: all totals minus all payments (payments never go over a visit's total, PR-2). */
export const outstanding = () => fromPiastres(db.all('visits').reduce((total, v) => total + toPiastres(v.total_amount), 0) - sum(db.all('payments')))

/** Who owes what: one row per patient with an unpaid balance, largest first. */
export function outstandingByPatient() {
  const rows = new Map()
  const unpaid = db
    .all('visits')
    .filter((v) => remainingPiastres(v) > 0)
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
  for (const visit of unpaid) {
    if (!rows.has(visit.patient_id)) {
      const patient = db.find('patients', visit.patient_id)
      const user = db.find('users', patient.user_id)
      // Oldest first, so the first visit seen is the oldest.
      rows.set(visit.patient_id, { patient_id: patient.id, patient_name: user.name, phone: user.phone, owed: 0, unpaid_visits: 0, oldest_visit_date: visit.visit_date })
    }
    const row = rows.get(visit.patient_id)
    row.owed += remainingPiastres(visit)
    row.unpaid_visits++
  }
  return [...rows.values()]
    .sort((a, b) => b.owed - a.owed || (a.patient_name < b.patient_name ? -1 : a.patient_name > b.patient_name ? 1 : 0))
    .map((row) => ({
      patient_id: row.patient_id,
      patient_name: row.patient_name,
      phone: row.phone,
      outstanding: fromPiastres(row.owed),
      unpaid_visits: row.unpaid_visits,
      oldest_visit_date: row.oldest_visit_date,
    }))
}

/** FR-H.3: the period's payments, newest visit first, then newest payment. */
export function payments(from, to) {
  const visitDate = (p) => db.find('visits', p.visit_id).visit_date
  return paymentsOfVisitsBetween(from, to).sort((a, b) => visitDate(b).localeCompare(visitDate(a)) || b.paid_at.localeCompare(a.paid_at) || b.id - a.id)
}

/** The table's totals over the whole period: remaining counts each visit once. */
export function paymentTotals(from, to) {
  const list = paymentsOfVisitsBetween(from, to)
  const visitIds = new Set(list.map((p) => p.visit_id))
  const owed = [...visitIds].reduce((total, id) => total + remainingPiastres(db.find('visits', id)), 0)
  return { count: list.length, paid: revenue(from, to), remaining: fromPiastres(owed) }
}

/** FR-H.4: revenue for every day of the month ("YYYY-MM") by visit date, 0.00 on quiet days. */
export function dailyRevenue(month) {
  const [from, to] = period('month', `${month}-01`)
  const byDay = new Map()
  for (const payment of paymentsOfVisitsBetween(from, to)) {
    const date = db.find('visits', payment.visit_id).visit_date
    byDay.set(date, (byDay.get(date) ?? 0) + toPiastres(payment.amount))
  }
  const rows = []
  for (let date = from; date <= to; date = addDays(date, 1)) rows.push({ date, revenue: fromPiastres(byDay.get(date) ?? 0) })
  return rows
}
