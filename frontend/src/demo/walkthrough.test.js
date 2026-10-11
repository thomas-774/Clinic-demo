import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as appointmentsApi from '../api/appointments'
import * as assistantApi from '../api/assistant'
import * as authApi from '../api/auth'
import client, { tokenStorage } from '../api/client'
import * as patientApi from '../api/patient'
import * as prescriptionsApi from '../api/prescriptions'
import * as reportsApi from '../api/reports'
import { getSlots } from '../api/slots'
import * as visitsApi from '../api/visits'
import { resetDemoData } from './control'
import { db, loginAs, resetDemo } from '../test/demo'

/**
 * D-13: the source's walkthrough (docs/walkthrough.md, WalkthroughTest.php)
 * on the demo, through the same API calls the pages make. A new patient
 * books; the assistant checks them in; the doctor records a 1500 visit with
 * 1000 paid and writes a prescription; the assistant takes the last 500; the
 * dashboard moves by exactly that visit; Reset brings the seed back.
 */
const at = (iso) => vi.setSystemTime(new Date(iso))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at('2026-10-12T16:00:00+03:00') // Monday, before the 17:00 opening
  resetDemo()
})

afterEach(() => {
  vi.useRealTimers()
})

describe.each(['en', 'ar'])('walkthrough (%s)', (language) => {
  it('book → check in → visit 1500 / 1000 + prescription → installment 500 → dashboard → reset', async () => {
    await i18next.changeLanguage(language)
    const booked = { en: 'Appointment booked.', ar: 'تم حجز الموعد.' }[language]

    await loginAs('doctor')
    const before = await reportsApi.getReportSummary('day')

    // 1. A new patient signs up and books the first free slot today.
    const { token: patientToken } = await authApi.register({
      name: 'Walkthrough Patient',
      phone: '01099990000',
      address: 'Dokki, Giza',
      password: 'walk-through-1',
      password_confirmation: 'walk-through-1',
    })
    tokenStorage.set(patientToken)
    const [slot] = (await getSlots('2026-10-12')).data
    // The page's call, read raw to see the message comes back in the interface language.
    const { data: bookedResponse } = await client.post('/patient/appointments', { start_at: slot.start_at })
    expect(bookedResponse.message).toBe(booked)
    const booking = bookedResponse.data
    expect((await appointmentsApi.getMyAppointments()).upcoming.map((a) => a.id)).toEqual([booking.id])
    const appointment = db.find('appointments', booking.id)
    expect(appointment.status).toBe('booked')

    // 2. The patient arrives; the assistant checks them in from today's schedule.
    at(new Date(new Date(slot.start_at).getTime() + 5 * 60000).toISOString())
    await loginAs('assistant')
    expect((await assistantApi.getSchedule({ from: '2026-10-12', to: '2026-10-12' })).map((a) => a.id)).toContain(booking.id)
    expect((await assistantApi.updateAppointmentStatus(booking.id, 'checked_in')).status).toBe('checked_in')

    // 3. The doctor: visit 1500, 1000 paid now → 500 remaining, appointment completed, and a prescription.
    await loginAs('doctor')
    const visit = await visitsApi.createVisit({
      patient_id: appointment.patient_id,
      appointment_id: booking.id,
      work_done: 'Root canal, session 1 of 2',
      total_amount: 1500,
      paid_now: 1000,
      method: 'cash',
    })
    expect(visit).toMatchObject({ paid: '1000.00', remaining: '500.00', payment_status: 'partially_paid' })
    expect(db.find('appointments', booking.id).status).toBe('completed')
    const drug = (await (await import('../api/drugs')).searchDrugs('brufen'))[0]
    const prescription = await prescriptionsApi.createPrescription(appointment.patient_id, {
      visit_id: visit.id,
      items: [{ drug_id: drug.id, instructions: '1 tablet after meals when needed' }],
    })
    expect(prescription.items[0].drug_name).toBe(drug.trade_name)

    // The patient now sees the balance.
    tokenStorage.set(patientToken)
    expect((await patientApi.getProfile()).outstanding_balance).toBe('500.00')

    // 4. Two days later the assistant takes the last 500 at the desk.
    at('2026-10-14T18:00:00+03:00')
    await loginAs('assistant')
    const owed = await assistantApi.getPatient(appointment.patient_id)
    expect(owed.outstanding_balance).toBe('500.00')
    const paid = await assistantApi.addPayment(visit.id, { amount: 500, method: 'cash' })
    expect(paid).toMatchObject({ remaining: '0.00', payment_status: 'paid' })
    expect(db.where('audit_logs', { action: 'created', auditable_id: paid.payments.at(-1).id }).length).toBeGreaterThan(0)
    tokenStorage.set(patientToken)
    expect((await patientApi.getProfile()).outstanding_balance).toBe('0.00')

    // 5. The dashboard for 12 October: one more visit and 1500 more revenue (both payments
    // count on the visit's date); the outstanding total is back where it was.
    at('2026-10-12T21:30:00+03:00')
    await loginAs('doctor')
    const after = await reportsApi.getReportSummary('day')
    const piastres = (amount) => Math.round(Number(amount) * 100)
    expect(after.visits).toBe(before.visits + 1)
    expect(piastres(after.revenue)).toBe(piastres(before.revenue) + 150000)
    expect(piastres(after.outstanding)).toBe(piastres(before.outstanding))
    const daily = await reportsApi.getDailyRevenue('2026-10')
    expect(daily.find((row) => row.date === '2026-10-12').revenue).toBe(after.revenue)

    // 6. Reset brings the seed back: the new patient and the visit are gone. (The seed
    // is built around the moment of the reset, so reset at the starting time to compare.)
    at('2026-10-12T16:00:00+03:00')
    await resetDemoData({ token: tokenStorage.get(), role: 'doctor' })
    expect(db.first('users', { phone: '01099990000' })).toBeNull()
    expect(db.find('visits', visit.id)?.work_done).not.toBe('Root canal, session 1 of 2')
    expect(await reportsApi.getReportSummary('day')).toEqual(before)
  })
})
