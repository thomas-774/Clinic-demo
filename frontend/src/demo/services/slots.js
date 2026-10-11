import { addDays, addMinutes, dayOfWeek, nowLocal, today } from '../clock'
import * as db from '../db'
import { HOLDING_SLOT } from './appointments'

/**
 * SlotService (FR-E.2, BR-1): the free slots of the clinic's doctor on a day.
 * Everything is compared as Cairo wall-clock strings ("YYYY-MM-DD HH:MM:SS"),
 * and days are date strings, so DST (which starts at midnight) cannot shift them.
 */

/** ClinicContext::doctor(): the clinic's single doctor. */
export const clinicDoctor = () =>
  db
    .where('users', { role: 'doctor' })
    .sort((a, b) => a.id - b.id)[0]

/** ClinicContext::settings(): the doctor's settings, or the defaults. */
export const clinicSettings = () =>
  db.first('doctor_settings', { doctor_id: clinicDoctor().id }) ?? {
    slot_duration_minutes: 45,
    booking_window_days: 30,
    cancel_cutoff_hours: 2,
    prescription_paper: 'A5',
  }

export const duration = () => clinicSettings().slot_duration_minutes

const overlaps = ([start, end], ranges) => ranges.some(([from, to]) => start < to && from < end)

/**
 * Free slots on `date` ("YYYY-MM-DD") as [start, end] wall-clock pairs, in time order.
 * Booked, blocked and past slots are left out; so are days outside the booking window.
 */
export function generate(date) {
  const doctor = clinicDoctor()
  const settings = clinicSettings()
  const todayDate = today()
  const now = nowLocal()
  if (date < todayDate || date > addDays(todayDate, settings.booking_window_days)) return []

  // 1. Working ranges for that weekday; none = day off.
  const ranges = db
    .where('working_hours', (row) => row.doctor_id === doctor.id && row.day_of_week === dayOfWeek(date))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
  const blocks = db.where('blocked_times', (row) => row.doctor_id === doctor.id && row.date === date)
  if (!ranges.length || blocks.some((block) => block.start_time === null && block.end_time === null)) return []

  // 2–3. Each range on its own, so a slot never crosses a break.
  const minutes = settings.slot_duration_minutes
  const slots = []
  for (const range of ranges) {
    const end = `${date} ${range.end_time}`
    for (let start = `${date} ${range.start_time}`; addMinutes(start, minutes) <= end; start = addMinutes(start, minutes)) {
      slots.push([start, addMinutes(start, minutes)])
    }
  }

  // 4. Taken by an appointment that still holds its time (any length, FR-G.4).
  const dayStart = `${date} 00:00:00`
  const nextDay = `${addDays(date, 1)} 00:00:00`
  const taken = db
    .where('appointments', (a) => a.doctor_id === doctor.id && HOLDING_SLOT.includes(a.status) && a.start_at < nextDay && a.end_at > dayStart)
    .map((a) => [a.start_at, a.end_at])

  // 5. Blocked time ranges.
  const blocked = blocks.map((block) => [`${date} ${block.start_time}`, `${date} ${block.end_time}`])

  return (
    slots
      .filter((slot) => !overlaps(slot, taken) && !overlaps(slot, blocked))
      // 6. Today: only slots that have not started yet.
      .filter(([start]) => start > now)
  )
}

/** BR-1: is `start` (wall clock) exactly the start of a free slot right now? */
export const isAvailable = (start) => generate(start.slice(0, 10)).some(([slotStart]) => slotStart === start)
