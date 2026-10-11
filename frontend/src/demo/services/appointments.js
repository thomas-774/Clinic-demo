import { addDays, addMinutes, fromLocal, nowLocal, today } from '../clock'
import * as db from '../db'
import { HttpError, abort, invalid } from '../http'
import { translate } from '../lang'

/**
 * Appointments (§4.3, AppointmentStatus, Appointment, AppointmentService and
 * BookingService): booked → checked_in / cancelled / no_show,
 * checked_in → completed / cancelled.
 */
const TRANSITIONS = {
  booked: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}

/** Statuses that keep the slot taken (appointments.active_slot). */
export const HOLDING_SLOT = ['booked', 'checked_in', 'completed']

/** How many future appointments (booked or checked in) a patient may hold (BR-4). */
export const MAX_ACTIVE_APPOINTMENTS = 1

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false

/** Sets the status and its timestamp (checked_in_at / cancelled_at). */
export function transitionTo(appointment, to) {
  const changes = { status: to }
  if (to === 'checked_in') changes.checked_in_at = nowLocal()
  if (to === 'cancelled') changes.cancelled_at = nowLocal()
  return db.update('appointments', appointment.id, changes)
}

/** AppointmentService::changeStatus(): 422 on `status` when §4.3 does not allow it. */
export function changeStatus(ctx, appointment, to) {
  if (!canTransition(appointment.status, to)) invalid(ctx, { status: translate(ctx.locale, 'This status change is not allowed.') })
  return transitionTo(appointment, to)
}

/** Still ahead of the patient: booked or checked in, and not over yet. */
export const isUpcoming = (appointment) => ['booked', 'checked_in'].includes(appointment.status) && appointment.end_at > nowLocal()

/** BR-5: a patient may cancel a booked appointment until start − cancel_cutoff_hours. */
export function patientCanCancel(appointment, cutoffHours) {
  return appointment.status === 'booked' && Date.now() <= fromLocal(appointment.start_at) - cutoffHours * 3600000
}

/** AppointmentService::schedule(): the doctor's appointments from `from` to `to` (inclusive dates, today by default). */
export function schedule(doctorId, from, to) {
  const start = from ?? today()
  const end = addDays(to ?? start, 1)
  return db
    .where('appointments', (a) => a.doctor_id === doctorId && a.start_at >= `${start} 00:00:00` && a.start_at < `${end} 00:00:00`)
    .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id)
}

/**
 * BookingService::book(): 422 when the patient already holds an upcoming
 * appointment (BR-4), 409 when the slot is not free any more (BR-1, BR-2).
 *
 * @param {(start: string) => boolean} isAvailable  SlotService::isAvailable
 */
export function book(ctx, { patient, start, doctorId, minutes, isAvailable }) {
  const now = nowLocal()
  const active = db.where('appointments', (a) => a.patient_id === patient.id && ['booked', 'checked_in'].includes(a.status) && a.start_at > now)
  if (active.length >= MAX_ACTIVE_APPOINTMENTS) {
    const message = translate(ctx.locale, 'You already have an upcoming appointment.')
    throw new HttpError(422, { message, errors: { start_at: [message] } })
  }
  // BR-1: the slots are generated again here; the client's list is not trusted.
  if (!isAvailable(start)) abort(ctx, 409, 'Slot no longer available.')
  return db.insert('appointments', {
    doctor_id: doctorId,
    patient_id: patient.id,
    start_at: start,
    // BR-3: stored, so a later duration change does not move it.
    end_at: addMinutes(start, minutes),
    status: 'booked',
    checked_in_at: null,
    cancelled_at: null,
  })
}
