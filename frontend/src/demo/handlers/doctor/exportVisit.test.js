import i18next from 'i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportVisit } from '../../../api/visits'
import * as visitsApi from '../../../api/visits'
import { money } from '../../visitReport'
import { db, failure, loginAs, resetDemo } from '../../../test/demo'

beforeEach(async () => {
  resetDemo()
  await loginAs('doctor')
})

const html = async (response) => response.data.text()

describe('visit export', () => {
  it('answers pdf with a printable report of the visit, and audits it', async () => {
    const visit = await visitsApi.createVisit({ patient_id: 12, work_done: 'Scaling\nPolishing', total_amount: '1500', paid_now: '600', method: 'card' })
    const response = await exportVisit(visit.id, 'pdf')
    expect(response.data.type).toMatch(/^text\/html/)
    expect(response.headers['content-disposition']).toBe(`attachment; filename="visit-${visit.visit_date}-${visit.id}.html"`)

    const page = await html(response)
    expect(page).toContain('<html lang="en" dir="ltr">')
    expect(page).toContain('Visit report')
    expect(page).toContain('Work done today')
    expect(page).toContain('Polishing')
    expect(page).toContain('1,500.00 EGP')
    expect(page).toContain('900.00 EGP')
    expect(page).toContain('Walk-in')
    expect(page).toContain('/visit-report.css')
    // Never medical history or the current illness (FR-K.3).
    const illness = db.find('patients', 12).current_illness
    if (illness) expect(page).not.toContain(illness)
    expect(db.where('audit_logs', { action: 'exported' })).toHaveLength(1)
  })

  it('is in Arabic, right to left, in the request language', async () => {
    await i18next.changeLanguage('ar')
    const visit = db.first('visits', (v) => v.appointment_id !== null)
    const page = await html(await exportVisit(visit.id, 'pdf'))
    expect(page).toContain('<html lang="ar" dir="rtl">')
    expect(page).toContain('تقرير الزيارة')
    expect(page).toContain('ج.م')
  })

  it('has no Word file in the demo, and checks the format', async () => {
    const visit = db.first('visits', () => true)
    const docx = await failure(exportVisit(visit.id, 'docx'))
    expect(docx.status).toBe(422)
    expect(JSON.parse(await docx.data.text())).toEqual({ message: 'Not available in the demo', errors: { format: ['Not available in the demo'] } })
    const bad = await failure(exportVisit(visit.id, 'xls'))
    expect(JSON.parse(await bad.data.text()).errors.format).toEqual(['The selected file format is invalid.'])
  })

  it('groups money on the string, piastre-exact', () => {
    expect(money('1234567.05', 'en')).toBe('1,234,567.05 EGP')
    expect(money('0.1', 'ar')).toBe('0.10 ج.م')
  })
})
