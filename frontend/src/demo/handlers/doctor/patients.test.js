import { beforeEach, describe, expect, it } from 'vitest'
import * as api from '../../../api/doctorPatients'
import * as visitsApi from '../../../api/visits'
import { today } from '../../clock'
import { db, failure, loginAs, resetDemo } from '../../../test/demo'

beforeEach(async () => {
  resetDemo()
  await loginAs('doctor')
})

const auditRows = (action) => db.where('audit_logs', { action })

describe('doctor patients', () => {
  it('lists 20 per page by name, with search by name or phone', async () => {
    const page = await api.listPatients()
    expect(page.data).toHaveLength(20)
    expect(page.meta).toMatchObject({ current_page: 1, last_page: 2, total: 30, per_page: 20 })
    expect(page.data[0]).toEqual({ id: expect.any(Number), name: expect.any(String), phone: expect.any(String), last_visit_date: expect.anything() })
    // Latin names sort before Arabic ones.
    expect(page.data[0].name).toBe('Ahmed Hassan')

    expect((await api.listPatients({ page: 2 })).data).toHaveLength(10)
    expect((await api.listPatients({ search: 'mona' })).data.map((p) => p.name)).toEqual(['Mona Ali'])
    expect((await api.listPatients({ search: '01020000030' })).data).toHaveLength(1)
  })

  it('creates a patient with a one-time password and audits it', async () => {
    const created = await api.createPatient({ name: 'Test Patient', phone: '0155-555-5555', email: '', address: 'Giza', gender: 'female' })
    expect(created).toMatchObject({ name: 'Test Patient', phone: '01555555555', email: null, gender: 'female', date_of_birth: null })
    expect(created.initial_password).toMatch(/^[a-z2-9]{8}$/)
    expect(auditRows('created').at(-1)).toMatchObject({ auditable_type: 'App\\Models\\Patient', auditable_id: created.id, patient_id: created.id, user_role: 'doctor' })
  })

  it('refuses a taken phone and a future date of birth', async () => {
    const res = await failure(api.createPatient({ name: 'X', phone: '01020000001', address: 'Giza', date_of_birth: '2999-01-01' }))
    expect(res.status).toBe(422)
    expect(Object.keys(res.data.errors)).toEqual(['phone', 'date_of_birth'])
    expect(res.data.errors.date_of_birth[0]).toBe('The date of birth field must be a date before or equal to today.')
  })

  it('shows the full profile with balance and audits the read', async () => {
    const patient = await api.getPatient(1)
    expect(patient).toMatchObject({ id: 1, name: 'أحمد حسن', phone: '01020000001', prescriptions_count: 1 })
    const owed = patient.visits.reduce((sum, v) => sum + Math.round(Number(v.remaining) * 100), 0)
    expect(Math.round(Number(patient.outstanding_balance) * 100)).toBe(owed)
    expect(patient.visits[0].payments[0]).toEqual({ id: expect.any(Number), amount: expect.any(String), method: expect.any(String), paid_at: expect.stringMatching(/\+0[23]:00$/) })
    expect(auditRows('viewed')).toHaveLength(1)
    await expect(api.getPatient(999)).rejects.toMatchObject({ response: { status: 404 } })
  })

  it('updates the patient and logs only the changed fields', async () => {
    const before = await api.getPatient(2)
    const updated = await api.updatePatient(2, { name: 'Renamed', phone: before.phone, address: 'New address', gender: before.gender })
    expect(updated).toMatchObject({ name: 'Renamed', address: 'New address' })
    expect(auditRows('updated').at(-1).changed_fields).toEqual(['address'])
  })

  it('adds, edits and deletes history entries, scoped to the patient', async () => {
    const entry = await api.addHistoryEntry(3, { type: 'allergy', title: 'Aspirin', recorded_on: today() })
    expect(entry).toMatchObject({ patient_id: 3, type: 'allergy', title: 'Aspirin', details: null, patient_visible: false })

    const edited = await api.updateHistoryEntry(3, entry.id, { type: 'allergy', title: 'Aspirin', patient_visible: true, recorded_on: today() })
    expect(edited.patient_visible).toBe(true)

    await expect(api.updateHistoryEntry(4, entry.id, { type: 'note', title: 'x', recorded_on: today() })).rejects.toMatchObject({ response: { status: 404 } })
    const bad = await failure(api.addHistoryEntry(3, { type: 'gossip', title: '', recorded_on: '2999-01-01' }))
    expect(Object.keys(bad.data.errors)).toEqual(['type', 'title', 'recorded_on'])

    await api.deleteHistoryEntry(3, entry.id)
    expect(db.find('medical_history_entries', entry.id)).toBeNull()
    expect(auditRows('deleted')).toHaveLength(1)
  })
})

describe('doctor visits and payments', () => {
  const bookedToday = () => db.first('appointments', (a) => a.status === 'booked')

  it('saves a visit for an appointment: first payment, appointment completed, visit on its date', async () => {
    const appointment = bookedToday()
    const visit = await visitsApi.createVisit({
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      work_done: 'Filling',
      total_amount: '1500',
      paid_now: '500.5',
      method: 'card',
    })
    expect(visit).toMatchObject({ visit_date: appointment.start_at.slice(0, 10), total_amount: '1500.00', paid: '500.50', remaining: '999.50', payment_status: 'partially_paid' })
    expect(visit.payments).toEqual([expect.objectContaining({ amount: '500.50', method: 'card' })])
    expect(db.find('appointments', appointment.id)).toMatchObject({ status: 'completed', checked_in_at: expect.any(String) })

    const again = await failure(visitsApi.createVisit({ patient_id: appointment.patient_id, appointment_id: appointment.id, work_done: 'x', total_amount: '1' }))
    expect(again.data.errors.appointment_id).toEqual(['This appointment is not open for a visit.'])
  })

  it('a walk-in visit is dated today and can be unpaid', async () => {
    const visit = await visitsApi.createVisit({ patient_id: 5, work_done: 'Check-up', total_amount: 300 })
    expect(visit).toMatchObject({ visit_date: today(), appointment_id: null, paid: '0.00', remaining: '300.00', payment_status: 'unpaid', payments: [] })
  })

  it('refuses a first payment above the total and another patient’s appointment', async () => {
    const appointment = bookedToday()
    const res = await failure(visitsApi.createVisit({ patient_id: 1, appointment_id: appointment.id, work_done: 'x', total_amount: '100', paid_now: '100.01' }))
    expect(res.data.errors).toEqual({ paid_now: ['The amount paid cannot be more than the total.'], appointment_id: ['This appointment belongs to another patient.'] })
  })

  it('keeps balances exact to the piastre across installments', async () => {
    const visit = await visitsApi.createVisit({ patient_id: 6, work_done: 'x', total_amount: '0.30', paid_now: '0.10' })
    const after = await visitsApi.addPayment(visit.id, { amount: '0.20', method: 'wallet' })
    expect(after).toMatchObject({ paid: '0.30', remaining: '0.00', payment_status: 'paid' })
    expect(after.payments.map((p) => p.amount)).toEqual(['0.10', '0.20'])

    const big = await visitsApi.createVisit({ patient_id: 6, work_done: 'x', total_amount: '1000.10' })
    await visitsApi.addPayment(big.id, { amount: '333.37' })
    await visitsApi.addPayment(big.id, { amount: '333.37' })
    const third = await visitsApi.addPayment(big.id, { amount: 333.36 })
    expect(third).toMatchObject({ paid: '1000.10', remaining: '0.00', payment_status: 'paid' })
  })

  it('refuses a payment over the remaining, a zero payment, three decimals and a future date', async () => {
    const visit = await visitsApi.createVisit({ patient_id: 7, work_done: 'x', total_amount: '750', paid_now: '0.5' })
    expect((await failure(visitsApi.addPayment(visit.id, { amount: '749.51' }))).data.errors.amount).toEqual(['The payment cannot be more than the remaining 749.50 EGP.'])
    expect((await failure(visitsApi.addPayment(visit.id, { amount: '0' }))).data.errors.amount).toEqual(['The amount field must be greater than 0.'])
    expect((await failure(visitsApi.addPayment(visit.id, { amount: '1.234' }))).data.errors.amount).toEqual(['The amount field must have 0-2 decimal places.'])
    expect((await failure(visitsApi.addPayment(visit.id, { amount: '1', paid_at: '2999-01-01T10:00:00Z' }))).data.errors.paid_at).toEqual([
      'The payment date field must be a date before or equal to now.',
    ])
  })

  it('a back-dated installment keeps its date; the total cannot drop below what was paid', async () => {
    const visit = await visitsApi.createVisit({ patient_id: 8, work_done: 'x', total_amount: '1000', paid_now: '600' })
    const after = await visitsApi.addPayment(visit.id, { amount: '100', paid_at: '2026-01-05T10:00:00+02:00' })
    expect(after.payments[0].paid_at).toBe('2026-01-05T10:00:00+02:00')

    const res = await failure(visitsApi.updateVisit(visit.id, { work_done: 'x', total_amount: '699.99' }))
    expect(res.data.errors.total_amount).toEqual(['The total cannot be lower than the 700.00 EGP already paid.'])
    expect(await visitsApi.updateVisit(visit.id, { work_done: 'More', total_amount: '700' })).toMatchObject({ remaining: '0.00', payment_status: 'paid' })
  })

  it('answers 403 to the other roles, before looking up the record', async () => {
    await loginAs('assistant')
    await expect(api.getPatient(999)).rejects.toMatchObject({ response: { status: 403 } })
    await loginAs('patient')
    await expect(visitsApi.addPayment(1, { amount: '1' })).rejects.toMatchObject({ response: { status: 403 } })
  })
})
