import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as auditApi from '../../../api/auditLogs'
import * as authApi from '../../../api/auth'
import * as reportsApi from '../../../api/reports'
import * as settingsApi from '../../../api/settings'
import * as visitsApi from '../../../api/visits'
import { toPiastres } from '../../money'
import * as payments from '../../services/payments'
import { db, failure, loginAs, resetDemo } from '../../../test/demo'

// Monday 12 Oct 2026, 10:00 in Cairo: no visits yet today (the clinic opens at 17:00).
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-12T10:00:00+03:00'))
  resetDemo()
  await loginAs('doctor')
})

afterEach(() => {
  vi.useRealTimers()
})

const piastres = (amount) => toPiastres(amount)

describe('summary', () => {
  it('gives the day, the Saturday-start week and the month', async () => {
    expect(await reportsApi.getReportSummary('day')).toMatchObject({ period: 'day', from: '2026-10-12', to: '2026-10-12', visits: 0, revenue: '0.00' })
    expect(await reportsApi.getReportSummary('week')).toMatchObject({ from: '2026-10-10', to: '2026-10-16' })
    expect(await reportsApi.getReportSummary('month')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    expect((await failure(reportsApi.getReportSummary('year'))).data.errors.period).toEqual(['The selected period is invalid.'])
  })

  it('counts visits, and revenue on the visit’s date, including later installments', async () => {
    const before = { day: await reportsApi.getReportSummary('day'), month: await reportsApi.getReportSummary('month') }

    await visitsApi.createVisit({ patient_id: 4, work_done: 'Walk-in', total_amount: '1500', paid_now: '1000' })
    const day = await reportsApi.getReportSummary('day')
    expect(day.visits).toBe(1)
    expect(day.revenue).toBe('1000.00')

    // An installment today on a visit of 5 October counts on 5 October, not today.
    const old = db.first('visits', (v) => v.visit_date === '2026-10-05' && payments.remainingPiastres(v) > 0) ?? db.first('visits', (v) => v.visit_date < '2026-10-10' && payments.remainingPiastres(v) > 0)
    const amount = payments.remaining(old)
    await visitsApi.addPayment(old.id, { amount })

    expect((await reportsApi.getReportSummary('day')).revenue).toBe('1000.00')
    const month = await reportsApi.getReportSummary('month')
    const expectedMonth = piastres(before.month.revenue) + 100000 + (old.visit_date >= '2026-10-01' ? piastres(amount) : 0)
    expect(piastres(month.revenue)).toBe(expectedMonth)
    // Outstanding: + 500 still owed on the walk-in, − the installment.
    expect(piastres(month.outstanding)).toBe(piastres(before.day.outstanding) + 50000 - piastres(amount))

    const daily = await reportsApi.getDailyRevenue(old.visit_date.slice(0, 7))
    const row = daily.find((r) => r.date === old.visit_date)
    const visitDay = db.where('visits', { visit_date: old.visit_date })
    const expectedDay = visitDay.reduce((sum, v) => sum + payments.paidPiastres(v), 0)
    expect(piastres(row.revenue)).toBe(expectedDay)
  })

  it('daily revenue covers every day of the month and adds up to the month’s revenue', async () => {
    const daily = await reportsApi.getDailyRevenue('2026-10')
    expect(daily).toHaveLength(31)
    expect(daily[0]).toEqual({ date: '2026-10-01', revenue: expect.stringMatching(/^\d+\.\d{2}$/) })
    expect(daily.find((r) => r.date === '2026-10-09').revenue).toBe('0.00') // a Friday
    const total = daily.reduce((sum, r) => sum + piastres(r.revenue), 0)
    expect(total).toBe(piastres((await reportsApi.getReportSummary('month')).revenue))
    expect((await failure(reportsApi.getDailyRevenue('2026-13'))).data.errors.month).toEqual(['The month field must match the format Y-m.'])
  })
})

describe('payments and outstanding', () => {
  it('pages the payments of the visits in the range, newest visit first, with totals', async () => {
    const page = await reportsApi.getReportPayments({ from: '2026-09-12', to: '2026-10-11' })
    expect(page.data).toHaveLength(20)
    expect(page.meta).toMatchObject({ current_page: 1, per_page: 20, range: { from: '2026-09-12', to: '2026-10-11' } })
    expect(page.meta.totals.count).toBe(db.all('payments').length)
    expect(page.meta.totals.paid).toBe((await reportsApi.getReportPayments({ from: '2026-09-12', to: '2026-10-11', page: 2 })).meta.totals.paid)
    const dates = page.data.map((r) => r.visit_date)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(page.data[0]).toEqual({
      id: expect.any(Number),
      paid_at: expect.stringMatching(/\+03:00$/),
      patient_id: expect.any(Number),
      patient_name: expect.any(String),
      visit_id: expect.any(Number),
      visit_date: expect.any(String),
      visit_total: expect.any(String),
      paid: expect.any(String),
      remaining: expect.any(String),
      recorded_by_name: expect.any(String),
    })
  })

  it('lists who owes what, largest first, adding up to the total', async () => {
    const res = await reportsApi.getOutstanding()
    const owed = res.data.map((r) => piastres(r.outstanding))
    expect(owed).toEqual([...owed].sort((a, b) => b - a))
    expect(owed.reduce((a, b) => a + b, 0)).toBe(piastres(res.meta.total))
    expect(res.data[0]).toMatchObject({ unpaid_visits: expect.any(Number), oldest_visit_date: expect.any(String), phone: expect.any(String) })
  })
})

describe('settings and staff', () => {
  it('reads and saves the settings, within their limits', async () => {
    expect(await settingsApi.getSettings()).toMatchObject({ slot_duration_minutes: 45, booking_window_days: 30, cancel_cutoff_hours: 2, prescription_paper: 'A5' })
    expect(await settingsApi.updateSettings({ slot_duration_minutes: '30', clinic_name: '' })).toMatchObject({ slot_duration_minutes: 30, clinic_name: null })
    const bad = await failure(settingsApi.updateSettings({ booking_window_days: 91, prescription_paper: 'A3' }))
    expect(bad.data.errors).toEqual({
      booking_window_days: ['The booking window days field must be between 1 and 90.'],
      prescription_paper: ['The selected paper size is invalid.'],
    })
  })

  it('creates an assistant with a one-time password; reset and deactivate log them out', async () => {
    const created = await settingsApi.createStaff({ name: 'Second Desk', phone: '01122223333' })
    expect(created).toMatchObject({ name: 'Second Desk', role: 'assistant', is_active: true, initial_password: expect.stringMatching(/^[a-z2-9]{8}$/) })
    expect((await settingsApi.getStaff()).map((s) => s.name)).toEqual(['Demo Assistant', 'Second Desk'])

    const { token } = await authApi.login({ login: '01122223333', password: created.initial_password })
    expect(db.where('tokens', { user_id: created.id })).toHaveLength(1)
    const reset = await settingsApi.updateStaff(created.id, { reset_password: true })
    expect(reset.initial_password).not.toBe(created.initial_password)
    expect(db.first('tokens', { token })).toBeNull()

    expect(await settingsApi.updateStaff(created.id, { is_active: false })).toMatchObject({ is_active: false })
    expect((await settingsApi.getStaff()).map((s) => s.name)).toEqual(['Demo Assistant', 'Second Desk'])
    expect((await failure(settingsApi.updateStaff(1, { name: 'Not staff' }))).status).toBe(404)
  })
})

describe('audit log', () => {
  it('lists the changes the other handlers wrote, newest first, filtered and translated', async () => {
    const visit = await visitsApi.createVisit({ patient_id: 9, work_done: 'x', total_amount: '200', paid_now: '50' })
    await visitsApi.updateVisit(visit.id, { work_done: 'y', total_amount: '200' })

    const page = await auditApi.listAuditLogs({ patientId: 9 })
    expect(page.filters.patient).toEqual({ id: 9, name: expect.any(String) })
    expect(page.data.map((r) => `${r.action} ${r.record.type}`)).toEqual(['updated visit', 'created payment', 'created visit'])
    expect(page.data[0]).toMatchObject({ user: { id: 1, name: 'Dr. Doctor' }, user_role: 'doctor', record: { label: 'Visit' }, changed_fields: [{ name: 'work_done', label: 'Work done' }] })

    await i18next.changeLanguage('ar')
    const ar = await auditApi.listAuditLogs({ action: 'updated' })
    expect(ar.data[0].record.label).toBe('الزيارة')
    expect(ar.data[0].changed_fields[0].label).toBe('العمل المنجز')
  })
})
