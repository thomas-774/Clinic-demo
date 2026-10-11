import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as assistantApi from '../../api/assistant'
import * as patientApi from '../../api/patient'
import * as visitsApi from '../../api/visits'
import * as payments from '../services/payments'
import { db, failure, loginAs, resetDemo } from '../../test/demo'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T10:00:00+03:00'))
  resetDemo()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('assistant', () => {
  beforeEach(() => loginAs('assistant'))

  it('sees contact info and money, never medical data', async () => {
    const patient = await assistantApi.getPatient(1)
    expect(patient).toMatchObject({ id: 1, name: 'أحمد حسن', next_appointment: null })
    expect(patient).not.toHaveProperty('current_illness')
    expect(patient).not.toHaveProperty('history')
    expect(patient.visits[0]).not.toHaveProperty('work_done')
    expect(patient.visits[0].payments[0]).toHaveProperty('recorded_by_name')
    expect(db.where('audit_logs', { action: 'viewed', user_role: 'assistant' })).toHaveLength(1)

    const booked = db.first('appointments', (a) => a.status === 'booked')
    expect((await assistantApi.getPatient(booked.patient_id)).next_appointment).toMatchObject({ id: booked.id, status: 'booked' })
  })

  it('creates and edits a patient without the current illness', async () => {
    const created = await assistantApi.createPatient({ name: 'Front Desk', phone: '01099998888', address: 'Dokki', current_illness: 'ignored' })
    expect(created).toMatchObject({ name: 'Front Desk', visits: [], outstanding_balance: '0.00', initial_password: expect.any(String) })
    expect(db.find('patients', created.id).current_illness).toBeNull()

    const updated = await assistantApi.updatePatient(created.id, { name: 'Front Desk', phone: '01099998888', address: 'Zamalek', current_illness: 'still ignored' })
    expect(updated.address).toBe('Zamalek')
    expect(db.find('patients', created.id).current_illness).toBeNull()
  })

  it('lists today’s unpaid visits and takes a payment for one', async () => {
    await loginAs('doctor')
    const visit = await visitsApi.createVisit({ patient_id: 10, work_done: 'x', total_amount: '800', paid_now: '300' })
    await visitsApi.createVisit({ patient_id: 11, work_done: 'x', total_amount: '100', paid_now: '100' })
    await loginAs('assistant')

    const waiting = await assistantApi.getUnpaidVisits()
    expect(waiting.map((v) => v.id)).toEqual([visit.id])
    expect(waiting[0]).toMatchObject({ remaining: '500.00', payment_status: 'partially_paid', patient: { id: 10 } })

    const paid = await assistantApi.addPayment(visit.id, { amount: '500', method: 'cash' })
    expect(paid).toMatchObject({ remaining: '0.00', payment_status: 'paid' })
    expect(paid.payments.at(-1)).toMatchObject({ amount: '500.00', recorded_by_name: 'Demo Assistant' })
    expect(await assistantApi.getUnpaidVisits()).toEqual([])

    const old = db.first('visits', (v) => payments.remainingPiastres(v) > 0)
    expect((await assistantApi.getUnpaidVisits({ date: old.visit_date })).map((v) => v.id)).toContain(old.id)
  })
})

describe('patient', () => {
  beforeEach(() => loginAs('patient'))

  it('shows the own profile with shared history only and the balance', async () => {
    const profile = await patientApi.getProfile()
    expect(profile).toMatchObject({ id: 1, name: 'أحمد حسن', next_appointment: null })
    const shared = db.where('medical_history_entries', (e) => e.patient_id === 1 && e.patient_visible)
    expect(profile.simple_history.map((e) => e.id).sort()).toEqual(shared.map((e) => e.id).sort())
    const owed = db.where('visits', { patient_id: 1 }).filter((v) => payments.remainingPiastres(v) > 0)
    expect(profile.unpaid_visits.map((v) => v.id).sort()).toEqual(owed.map((v) => v.id).sort())
    expect(profile.outstanding_balance).toBe(payments.sumRemaining(db.where('visits', { patient_id: 1 })))
  })

  it('changes only the phone and the address', async () => {
    const updated = await patientApi.updateProfile({ phone: '0102 000 9999', address: 'New street' })
    expect(updated).toMatchObject({ phone: '01020009999', address: 'New street' })
    // Patients' own changes are not audited.
    expect(db.all('audit_logs')).toHaveLength(0)
    const taken = await failure(patientApi.updateProfile({ phone: '01000000000', address: 'x' }))
    expect(taken.data.errors.phone).toEqual(['The phone has already been taken.'])
  })
})
