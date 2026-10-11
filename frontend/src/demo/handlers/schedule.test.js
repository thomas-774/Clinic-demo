import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as appointmentsApi from '../../api/appointments'
import * as assistantApi from '../../api/assistant'
import * as settingsApi from '../../api/settings'
import { getSlots } from '../../api/slots'
import { db, failure, loginAs, resetDemo } from '../../test/demo'

// Monday 12 Oct 2026, 10:00 in Cairo (+03:00). The seed books today's 17:00, 17:45 and 18:30.
const MONDAY_MORNING = new Date('2026-10-12T10:00:00+03:00')
const at = (iso) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MONDAY_MORNING)
  resetDemo()
})

afterEach(() => {
  vi.useRealTimers()
})

const starts = (res) => res.data.map((slot) => slot.start_at)
/** A patient with no booking still ahead (BR-4 allows one). */
const freePatientId = () => db.all('patients').find((p) => !db.first('appointments', (a) => a.patient_id === p.id && a.status === 'booked')).id

describe('slots', () => {
  it('lists the free slots of a day, without booked ones, in Cairo time', async () => {
    await loginAs('patient')
    const res = await getSlots('2026-10-12')
    expect(starts(res)).toEqual(['2026-10-12T19:15:00+03:00', '2026-10-12T20:00:00+03:00'])
    expect(res.data[0].end_at).toBe('2026-10-12T20:00:00+03:00')
    expect(res.meta).toEqual({ date: '2026-10-12', duration: 45, booking_window_days: 30 })
  })

  it('hides slots that have started, past days, Fridays and days past the booking window', async () => {
    await loginAs('patient')
    at('2026-10-12T19:30:00+03:00')
    expect(starts(await getSlots('2026-10-12'))).toEqual(['2026-10-12T20:00:00+03:00'])
    expect((await getSlots('2026-10-11')).data).toEqual([])
    expect((await getSlots('2026-10-16')).data).toEqual([]) // Friday
    expect((await getSlots('2026-11-11')).data).toHaveLength(5) // the last day of the 30-day window
    expect((await getSlots('2026-11-12')).data).toEqual([])
  })

  it('uses winter time after DST ends, with the same wall-clock hours', async () => {
    await loginAs('patient')
    expect(starts(await getSlots('2026-10-31'))[0]).toBe('2026-10-31T17:00:00+02:00')
    expect(starts(await getSlots('2026-10-29'))[0]).toBe('2026-10-29T17:00:00+03:00')
  })

  it('needs a valid date and a logged-in user', async () => {
    await loginAs('doctor')
    expect((await failure(getSlots('12/10/2026'))).data.errors.date).toEqual(['The date field must match the format Y-m-d.'])
  })
})

describe('booking', () => {
  it('a patient books a free slot once; a second booking is refused (BR-4)', async () => {
    await loginAs('patient')
    const booked = await appointmentsApi.bookAppointment('2026-10-12T19:15:00+03:00')
    expect(booked).toEqual({
      id: expect.any(Number),
      start_at: '2026-10-12T19:15:00+03:00',
      end_at: '2026-10-12T20:00:00+03:00',
      status: 'booked',
      checked_in_at: null,
      cancelled_at: null,
      can_cancel: true,
    })
    const again = await failure(appointmentsApi.bookAppointment('2026-10-13T17:00:00+03:00'))
    expect(again.status).toBe(422)
    expect(again.data).toEqual({ message: 'You already have an upcoming appointment.', errors: { start_at: ['You already have an upcoming appointment.'] } })
  })

  it('answers 409 when the slot is taken, blocked or not a slot at all', async () => {
    await loginAs('patient')
    for (const startAt of ['2026-10-12T17:00:00+03:00', '2026-10-12T19:20:00+03:00', '2026-10-16T17:00:00+03:00']) {
      const res = await failure(appointmentsApi.bookAppointment(startAt))
      expect(res).toMatchObject({ status: 409, data: { message: 'Slot no longer available.' } })
    }
  })

  it('a slot given as UTC is the same Cairo slot', async () => {
    await loginAs('assistant')
    const booked = await assistantApi.bookForPatient({ patient_id: freePatientId(), start_at: '2026-10-12T16:15:00Z' })
    expect(booked.start_at).toBe('2026-10-12T19:15:00+03:00')
    expect(booked.patient).toEqual({ id: expect.any(Number), name: expect.any(String), phone: expect.any(String) })
    expect(booked).not.toHaveProperty('can_cancel')
  })

  it('the patient cancels until the cut-off; the slot is free again', async () => {
    await loginAs('patient')
    const booked = await appointmentsApi.bookAppointment('2026-10-12T19:15:00+03:00')

    at('2026-10-12T17:16:00+03:00') // less than 2 hours before
    expect((await appointmentsApi.getMyAppointments()).upcoming[0].can_cancel).toBe(false)
    expect(await failure(appointmentsApi.cancelMyAppointment(booked.id))).toMatchObject({
      status: 422,
      data: { message: 'Too late to cancel online, please call the clinic.' },
    })

    at('2026-10-12T17:15:00+03:00') // exactly 2 hours before
    const cancelled = await appointmentsApi.cancelMyAppointment(booked.id)
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelled_at: '2026-10-12T17:15:00+03:00', can_cancel: false })
    expect(starts(await getSlots('2026-10-12'))).toContain('2026-10-12T19:15:00+03:00')
  })

  it('a patient cannot cancel someone else’s appointment', async () => {
    await loginAs('patient')
    const other = db.first('appointments', (a) => a.status === 'booked')
    expect((await failure(appointmentsApi.cancelMyAppointment(other.id))).status).toBe(403)
  })

  it('lists the patient’s upcoming soonest first and past newest first', async () => {
    await loginAs('patient')
    await appointmentsApi.bookAppointment('2026-10-12T20:00:00+03:00')
    const mine = await appointmentsApi.getMyAppointments()
    expect(mine.upcoming.map((a) => a.start_at)).toEqual(['2026-10-12T20:00:00+03:00'])
    const past = mine.past.map((a) => a.start_at)
    expect(past).toEqual([...past].sort().reverse())
  })
})

describe('staff schedules and statuses', () => {
  it('returns today by default and a date range with patients, by time', async () => {
    await loginAs('doctor')
    const today = await appointmentsApi.getSchedule({})
    expect(today.map((a) => a.start_at)).toEqual(['2026-10-12T17:00:00+03:00', '2026-10-12T17:45:00+03:00', '2026-10-12T18:30:00+03:00'])
    expect(today[0].patient).toBeDefined()
    const week = await appointmentsApi.getSchedule({ from: '2026-10-05', to: '2026-10-11' })
    expect(week.every((a) => a.start_at >= '2026-10-05' && a.start_at < '2026-10-12')).toBe(true)
    expect((await failure(appointmentsApi.getSchedule({ from: '2026-10-12', to: '2026-10-11' }))).data.errors.to).toEqual([
      'The to field must be a date after or equal to from.',
    ])
  })

  it('follows the status rules (§4.3) for the doctor and the assistant', async () => {
    await loginAs('assistant')
    const [first, second] = await assistantApi.getSchedule({})
    expect(await assistantApi.updateAppointmentStatus(first.id, 'checked_in')).toMatchObject({ status: 'checked_in', checked_in_at: '2026-10-12T10:00:00+03:00' })
    expect((await failure(assistantApi.updateAppointmentStatus(first.id, 'completed'))).data.errors.status).toEqual(['The selected status is invalid.'])

    await loginAs('doctor')
    expect(await appointmentsApi.updateAppointmentStatus(first.id, 'completed')).toMatchObject({ status: 'completed' })
    expect((await failure(appointmentsApi.updateAppointmentStatus(second.id, 'completed'))).data.errors.status).toEqual(['This status change is not allowed.'])
    expect(await appointmentsApi.updateAppointmentStatus(second.id, 'no_show')).toMatchObject({ status: 'no_show' })
  })
})

describe('blocked times and working hours', () => {
  it('a whole-day block empties the day; a time block hides overlapping slots', async () => {
    await loginAs('doctor')
    await settingsApi.addBlockedTime({ date: '2026-10-13', reason: 'Conference' })
    const part = await settingsApi.addBlockedTime({ date: '2026-10-14', start_time: '17:30', end_time: '18:00' })
    expect(part).toEqual({ id: expect.any(Number), date: '2026-10-14', whole_day: false, start_time: '17:30', end_time: '18:00', reason: null })

    expect((await getSlots('2026-10-13')).data).toEqual([])
    const slots14 = starts(await getSlots('2026-10-14'))
    expect(slots14).not.toContain('2026-10-14T17:00:00+03:00')
    expect(slots14).not.toContain('2026-10-14T17:45:00+03:00')

    const list = await settingsApi.getBlockedTimes()
    expect(list.map((b) => b.date)).toEqual(['2026-10-13', '2026-10-14'])
    await settingsApi.deleteBlockedTime(part.id)
    expect(await settingsApi.getBlockedTimes()).toHaveLength(1)
  })

  it('refuses a past date and an end before the start', async () => {
    await loginAs('doctor')
    const res = await failure(settingsApi.addBlockedTime({ date: '2026-10-11', start_time: '18:00', end_time: '17:00' }))
    expect(res.data.errors).toEqual({
      date: ['The date field must be a date after or equal to today.'],
      end_time: ['The end time field must be a date after start time.'],
    })
    expect((await failure(settingsApi.addBlockedTime({ date: '2026-10-20', start_time: '18:00' }))).data.errors.end_time).toEqual([
      'The end time field is required when start time is present.',
    ])
  })

  it('replaces the week and refuses overlapping ranges', async () => {
    await loginAs('doctor')
    expect((await settingsApi.getWorkingHours())[5]).toEqual({ day_of_week: 5, ranges: [] })
    const days = [{ day_of_week: 5, ranges: [{ start_time: '10:00', end_time: '12:00' }, { start_time: '13:00', end_time: '14:00' }] }]
    const week = await settingsApi.updateWorkingHours(days)
    expect(week).toHaveLength(7)
    expect(week[5].ranges).toEqual(days[0].ranges)
    expect(week[1].ranges).toEqual([])
    expect(starts(await getSlots('2026-10-16'))).toEqual(['2026-10-16T10:00:00+03:00', '2026-10-16T10:45:00+03:00', '2026-10-16T13:00:00+03:00'])

    const overlap = await failure(
      settingsApi.updateWorkingHours([{ day_of_week: 1, ranges: [{ start_time: '17:00', end_time: '19:00' }, { start_time: '18:00', end_time: '20:00' }] }]),
    )
    expect(overlap.data.errors).toEqual({ 'days.0.ranges.1.start_time': ['Time ranges on the same day must not overlap.'] })
  })
})
