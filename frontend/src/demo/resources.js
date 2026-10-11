import { toIso } from './clock'
import * as db from './db'
import { patientCanCancel } from './services/appointments'
import * as payments from './services/payments'

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

export const userOf = (patient) => db.find('users', patient.user_id)

/** A patient's visits, newest first (orderByDesc visit_date, id). */
export const visitsOf = (patient) =>
  db.where('visits', { patient_id: patient.id }).sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.id - a.id)

/** PatientResource */
export function patient(row) {
  const account = userOf(row)
  return {
    id: row.id,
    user_id: row.user_id,
    name: account.name,
    phone: account.phone,
    email: account.email,
    address: row.address,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    current_illness: row.current_illness,
  }
}

/** PatientListItemResource (last_visit_date = the latest visit_date). */
export function patientListItem(row) {
  const account = userOf(row)
  const last = db.where('visits', { patient_id: row.id }).reduce((max, visit) => (max && max > visit.visit_date ? max : visit.visit_date), null)
  return { id: row.id, name: account.name, phone: account.phone, last_visit_date: last }
}

/** DetailedHistoryEntryResource */
export const historyEntry = (row) => ({
  id: row.id,
  patient_id: row.patient_id,
  type: row.type,
  title: row.title,
  details: row.details,
  patient_visible: row.patient_visible,
  recorded_on: row.recorded_on,
  created_at: toIso(row.created_at),
  updated_at: toIso(row.updated_at),
})

/** The patient's history, newest first (orderByDesc recorded_on, id). */
export const historyOf = (patientRow, filter = () => true) =>
  db
    .where('medical_history_entries', (entry) => entry.patient_id === patientRow.id && filter(entry))
    .sort((a, b) => b.recorded_on.localeCompare(a.recorded_on) || b.id - a.id)

/** PaymentResource; recorded_by_name only when the caller loaded recordedBy. */
export function payment(row, { withRecorder = false } = {}) {
  const out = { id: row.id, amount: row.amount, method: row.method, paid_at: toIso(row.paid_at) }
  if (withRecorder) out.recorded_by_name = row.recorded_by ? (db.find('users', row.recorded_by)?.name ?? null) : null
  return out
}

/** The visit's payments sorted by paid_at (sortBy keeps insertion order for ties). */
const sortedPayments = (visitRow) =>
  payments
    .paymentsOf(visitRow)
    .map((row, i) => [row, i])
    .sort(([a, i], [b, j]) => a.paid_at.localeCompare(b.paid_at) || i - j)
    .map(([row]) => row)

/** VisitResource (always with its payments: every doctor endpoint loads them). */
export const visit = (row) => ({
  id: row.id,
  patient_id: row.patient_id,
  appointment_id: row.appointment_id,
  visit_date: row.visit_date,
  work_done: row.work_done,
  total_amount: row.total_amount,
  paid: payments.paid(row),
  remaining: payments.remaining(row),
  payment_status: payments.status(row),
  payments: sortedPayments(row).map((p) => payment(p)),
})

/** PatientDetailResource */
export function patientDetail(row) {
  const visits = visitsOf(row)
  return {
    ...patient(row),
    history: historyOf(row).map(historyEntry),
    visits: visits.map(visit),
    outstanding_balance: payments.sumRemaining(visits),
    prescriptions_count: db.where('prescriptions', { patient_id: row.id }).length,
  }
}

/**
 * AppointmentResource. `can_cancel` only for a patient user; `patient` only
 * when the endpoint loads it (the schedules and staff bookings do).
 */
export function appointment(row, { forPatient = false, cutoffHours = 2, withPatient = false } = {}) {
  const out = {
    id: row.id,
    start_at: toIso(row.start_at),
    end_at: toIso(row.end_at),
    status: row.status,
    checked_in_at: toIso(row.checked_in_at),
    cancelled_at: toIso(row.cancelled_at),
  }
  if (forPatient) out.can_cancel = patientCanCancel(row, cutoffHours)
  if (withPatient) {
    const patientRow = db.find('patients', row.patient_id)
    const account = userOf(patientRow)
    out.patient = { id: patientRow.id, name: account.name, phone: account.phone }
  }
  return out
}

/** BlockedTimeResource */
export const blockedTime = (row) => ({
  id: row.id,
  date: row.date,
  whole_day: row.start_time === null && row.end_time === null,
  start_time: row.start_time ? row.start_time.slice(0, 5) : null,
  end_time: row.end_time ? row.end_time.slice(0, 5) : null,
  reason: row.reason,
})

/** AssistantVisitResource; `withPatient` / `withPayments` follow what the endpoint loads. */
export function assistantVisit(row, { withPatient = false, withPayments = false } = {}) {
  const out = {
    id: row.id,
    patient_id: row.patient_id,
    visit_date: row.visit_date,
    total_amount: row.total_amount,
    paid: payments.paid(row),
    remaining: payments.remaining(row),
    payment_status: payments.status(row),
  }
  if (withPatient) {
    const patientRow = db.find('patients', row.patient_id)
    const account = userOf(patientRow)
    out.patient = { id: patientRow.id, name: account.name, phone: account.phone }
  }
  if (withPayments) out.payments = sortedPayments(row).map((p) => payment(p, { withRecorder: true }))
  return out
}
