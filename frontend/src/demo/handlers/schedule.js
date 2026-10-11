import { parseToLocal, toIso, today } from '../clock'
import * as db from '../db'
import { abort, json, resource } from '../http'
import * as resources from '../resources'
import * as appointments from '../services/appointments'
import * as slots from '../services/slots'
import { exists, oneOf, validate } from '../validate'
import { __, bind } from './shared'

/**
 * Slots and appointments for every role: SlotController, the doctor's and the
 * assistant's ScheduleController, the patient's AppointmentController, and
 * the doctor's BlockedTimeController and WorkingHoursController.
 */

const withPatient = (row) => resources.appointment(row, { withPatient: true })

// ---- GET /slots ----

/** Free slots for a date (FR-E.2). Booked, blocked and past slots are not listed. */
export function slotList(ctx) {
  const { date } = validate(ctx, ctx.input, { date: ['required', 'date_format:Y-m-d'] })
  const settings = slots.clinicSettings()
  return json({
    data: slots.generate(date).map(([start, end]) => ({ start_at: toIso(start), end_at: toIso(end) })),
    // Patients cannot read the doctor settings; the date picker needs its limit (FR-E.1).
    meta: { date, duration: settings.slot_duration_minutes, booking_window_days: settings.booking_window_days },
    message: null,
  })
}

// ---- staff schedules (doctor and assistant) ----

const scheduleRange = (ctx) =>
  validate(ctx, ctx.input, { from: ['nullable', 'date_format:Y-m-d'], to: ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'] })

/** GET …/appointments?from=&to=: every status, by time; both dates inclusive, today by default. */
export function staffSchedule(ctx) {
  const { from = null, to = null } = scheduleRange(ctx)
  const rows = appointments.schedule(slots.clinicDoctor().id, from, to)
  return resource(rows.map(withPatient))
}

/** Books the slot starting at the request's start_at for `patient` (BookingService). */
function bookFor(ctx, patient, startAt) {
  return appointments.book(ctx, {
    patient,
    start: parseToLocal(startAt),
    doctorId: slots.clinicDoctor().id,
    minutes: slots.duration(),
    isAvailable: slots.isAvailable,
  })
}

/** POST …/appointments { patient_id, start_at }: same rules as the patient's booking. */
export function staffBook(ctx) {
  const data = validate(
    ctx,
    ctx.input,
    { patient_id: ['required', 'integer', exists('patients')], start_at: ['required', 'date'] },
    { attributes: { patient_id: 'patient', start_at: 'start time' } },
  )
  const appointment = bookFor(ctx, db.find('patients', data.patient_id), data.start_at)
  return resource(withPatient(appointment), __(ctx, 'Appointment booked.'), 201)
}

const DOCTOR_STATUSES = ['checked_in', 'completed', 'cancelled', 'no_show']
const ASSISTANT_STATUSES = ['checked_in', 'no_show', 'cancelled']

/** PATCH …/appointments/{appointment}/status: the cut-off for patients (BR-5) does not apply to staff. */
function staffStatus(ctx, allowed) {
  const appointment = bind(ctx, 'appointments', 'appointment')
  const { status } = validate(ctx, ctx.input, { status: ['required', oneOf(allowed)] }, { attributes: { status: 'status' } })
  if (appointment.doctor_id !== slots.clinicDoctor().id) abort(ctx, 404)
  appointments.changeStatus(ctx, appointment, status)
  return resource(withPatient(appointment), __(ctx, 'Status updated.'))
}

export const doctorStatus = (ctx) => staffStatus(ctx, DOCTOR_STATUSES)
export const assistantStatus = (ctx) => staffStatus(ctx, ASSISTANT_STATUSES)

// ---- the patient's own appointments ----

/** The logged-in patient's record ($request->user()->patient()->firstOrFail()). */
export function ownPatient(ctx) {
  const patient = db.first('patients', { user_id: ctx.user.id })
  if (!patient) abort(ctx, 404)
  return patient
}

const forPatient = (row) => resources.appointment(row, { forPatient: true, cutoffHours: slots.clinicSettings().cancel_cutoff_hours })

/** GET /patient/appointments: { upcoming (soonest first), past (newest first) }. */
export function patientIndex(ctx) {
  const patient = ownPatient(ctx)
  const rows = db.where('appointments', { patient_id: patient.id }).sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id)
  const upcoming = rows.filter(appointments.isUpcoming)
  const past = rows.filter((row) => !appointments.isUpcoming(row)).reverse()
  return json({ data: { upcoming: upcoming.map(forPatient), past: past.map(forPatient) }, message: null })
}

/** POST /patient/appointments { start_at } */
export function patientBook(ctx) {
  const patient = ownPatient(ctx)
  const { start_at: startAt } = validate(ctx, ctx.input, { start_at: ['required', 'date'] }, { attributes: { start_at: 'start time' } })
  const appointment = bookFor(ctx, patient, startAt)
  return resource(forPatient(appointment), __(ctx, 'Appointment booked.'), 201)
}

/** PATCH /patient/appointments/{appointment}/cancel: own and booked only, until the cut-off (BR-5). */
export function patientCancel(ctx) {
  const appointment = bind(ctx, 'appointments', 'appointment')
  const patient = db.first('patients', { user_id: ctx.user.id })
  if (!patient || appointment.patient_id !== patient.id) abort(ctx, 403)
  if (!appointments.patientCanCancel(appointment, slots.clinicSettings().cancel_cutoff_hours)) {
    abort(ctx, 422, 'Too late to cancel online, please call the clinic.')
  }
  appointments.transitionTo(appointment, 'cancelled')
  return resource(forPatient(appointment), __(ctx, 'Appointment cancelled.'))
}

// ---- blocked times (doctor) ----

const byBlockOrder = (a, b) =>
  a.date.localeCompare(b.date) || (a.start_time === null ? 0 : 1) - (b.start_time === null ? 0 : 1) || String(a.start_time ?? '').localeCompare(String(b.start_time ?? ''))

/** GET /doctor/blocked-times?from=&to=: from defaults to today; whole-day blocks first. */
export function blockedIndex(ctx) {
  const range = scheduleRange(ctx)
  const from = range.from ?? today()
  const rows = db
    .where('blocked_times', (b) => b.doctor_id === ctx.user.id && b.date >= from && (!range.to || b.date <= range.to))
    .sort(byBlockOrder)
  return resource(rows.map(resources.blockedTime))
}

export function blockedStore(ctx) {
  const data = validate(
    ctx,
    ctx.input,
    {
      date: ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
      start_time: ['nullable', 'required_with:end_time', 'date_format:H:i'],
      end_time: ['nullable', 'required_with:start_time', 'date_format:H:i', 'after:start_time'],
      reason: ['nullable', 'string', 'max:150'],
    },
    { attributes: { start_time: 'start time', end_time: 'end time' } },
  )
  const block = db.insert('blocked_times', {
    doctor_id: ctx.user.id,
    date: data.date,
    // TIME columns read back as "HH:MM:SS".
    start_time: data.start_time ? `${data.start_time}:00` : null,
    end_time: data.end_time ? `${data.end_time}:00` : null,
    reason: data.reason ?? null,
  })
  return resource(resources.blockedTime(block), __(ctx, 'Time blocked.'), 201)
}

export function blockedDestroy(ctx) {
  const block = bind(ctx, 'blocked_times', 'blockedTime')
  if (block.doctor_id !== ctx.user.id) abort(ctx, 404)
  db.remove('blocked_times', block.id)
  return json({ data: null, message: __(ctx, 'Block removed.') })
}

// ---- working hours (doctor) ----

/** Always 7 days (0 = Sunday … 6 = Saturday). */
function week(doctorId) {
  const rows = db.where('working_hours', { doctor_id: doctorId }).sort((a, b) => a.start_time.localeCompare(b.start_time))
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    ranges: rows.filter((row) => row.day_of_week === day).map((row) => ({ start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5) })),
  }))
}

export const hoursIndex = (ctx) => json({ data: week(ctx.user.id), message: null })

/** PUT /doctor/working-hours: replaces the whole week. */
export function hoursUpdate(ctx) {
  const data = validate(
    ctx,
    ctx.input,
    {
      days: ['present', 'array', 'max:7'],
      'days.*.day_of_week': ['required', 'integer', 'between:0,6', 'distinct'],
      'days.*.ranges': ['present', 'array', 'max:10'],
      'days.*.ranges.*.start_time': ['required', 'date_format:H:i'],
      'days.*.ranges.*.end_time': ['required', 'date_format:H:i', 'after:days.*.ranges.*.start_time'],
    },
    {
      attributes: { 'days.*.day_of_week': 'day', 'days.*.ranges.*.start_time': 'start time', 'days.*.ranges.*.end_time': 'end time' },
      after(add, errors) {
        if (Object.keys(errors).length) return
        Object.entries(ctx.input.days ?? {}).forEach(([dayIndex, day]) => {
          const ranges = Object.entries(day.ranges ?? {})
            .map(([index, range]) => ({ ...range, index }))
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
          for (let i = 1; i < ranges.length; i++) {
            if (ranges[i].start_time < ranges[i - 1].end_time) {
              add(`days.${dayIndex}.ranges.${ranges[i].index}.start_time`, __(ctx, 'Time ranges on the same day must not overlap.'))
            }
          }
        })
      },
    },
  )
  db.remove('working_hours', { doctor_id: ctx.user.id })
  for (const day of Object.values(data.days)) {
    for (const range of Object.values(day.ranges)) {
      db.insert('working_hours', { doctor_id: ctx.user.id, day_of_week: Number(day.day_of_week), start_time: `${range.start_time}:00`, end_time: `${range.end_time}:00` })
    }
  }
  return json({ data: week(ctx.user.id), message: __(ctx, 'Working hours saved.') })
}

