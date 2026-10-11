import { nowLocal } from '../clock'
import * as db from '../db'

/**
 * Appointment statuses (§4.3, AppointmentStatus + Appointment model):
 * booked → checked_in / cancelled / no_show, checked_in → completed / cancelled.
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

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false

/** Sets the status and its timestamp (checked_in_at / cancelled_at). */
export function transitionTo(appointment, to) {
  const changes = { status: to }
  if (to === 'checked_in') changes.checked_in_at = nowLocal()
  if (to === 'cancelled') changes.cancelled_at = nowLocal()
  return db.update('appointments', appointment.id, changes)
}
