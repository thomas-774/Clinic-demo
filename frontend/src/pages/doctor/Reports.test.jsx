import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as patientsApi from '../../api/doctorPatients'
import * as reportsApi from '../../api/reports'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

// paid_at, patient, visit (and its date), visit total, paid, remaining (what the visit still owes now)
const PAYMENTS = [
  { id: 5, paid_at: '2026-10-05T17:00:00+03:00', patient_id: 1, patient_name: 'Mona Ali', visit_id: 1, visit_date: '2026-10-05', visit_total: '1500.00', paid: '1000.00', remaining: '500.00', recorded_by_name: 'Amal Saad' },
  { id: 4, paid_at: '2026-10-05T09:00:00+03:00', patient_id: 2, patient_name: 'Ahmed Hassan', visit_id: 2, visit_date: '2026-10-03', visit_total: '800.00', paid: '200.00', remaining: '300.00' },
  { id: 3, paid_at: '2026-10-03T10:00:00+03:00', patient_id: 2, patient_name: 'Ahmed Hassan', visit_id: 2, visit_date: '2026-10-03', visit_total: '800.00', paid: '300.00', remaining: '300.00' },
  { id: 2, paid_at: '2026-10-01T12:00:00+03:00', patient_id: 3, patient_name: 'Sara Adel', visit_id: 3, visit_date: '2026-10-01', visit_total: '600.00', paid: '600.00', remaining: '0.00' },
  { id: 1, paid_at: '2026-09-28T12:00:00+03:00', patient_id: 3, patient_name: 'Sara Adel', visit_id: 4, visit_date: '2026-09-28', visit_total: '400.00', paid: '100.00', remaining: '300.00' },
]

/** Filters by visit date like GET /doctor/reports/payments; totals count each visit's remaining once. */
function fakePayments({ perPage = 20 } = {}) {
  return vi.spyOn(reportsApi, 'getReportPayments').mockImplementation(async ({ from, to, page = 1 }) => {
    const rows = PAYMENTS.filter((p) => p.visit_date >= from && p.visit_date <= to)
    const cents = (v) => Math.round(Number(v) * 100)
    const paid = rows.reduce((s, r) => s + cents(r.paid), 0)
    const visits = new Map(rows.map((r) => [r.visit_id, cents(r.remaining)]))
    const remaining = [...visits.values()].reduce((s, v) => s + v, 0)
    return {
      data: rows.slice((page - 1) * perPage, page * perPage),
      meta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(rows.length / perPage)),
        total: rows.length,
        range: { from, to },
        totals: { count: rows.length, paid: (paid / 100).toFixed(2), remaining: (remaining / 100).toFixed(2) },
      },
      message: null,
    }
  })
}

function renderReports(path = '/doctor/reports') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt(path)
}

const periodButton = (name) => within(screen.getByRole('group', { name: 'Period' })).getByRole('button', { name })
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1, -1)
/** Cell texts with Intl's non-breaking spaces turned into plain ones. */
const cellTexts = (row) => within(row).getAllByRole('cell').map((c) => c.textContent.replace(/\s/g, ' '))
const totalsRow = () => within(screen.getByRole('table')).getAllByRole('row').at(-1)

describe('Reports: payments table', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z')) // Monday 17:20 in Cairo
    vi.spyOn(reportsApi, 'getDailyRevenue').mockResolvedValue([]) // the chart is covered in RevenueChart.test.jsx
  })

  afterEach(() => vi.useRealTimers())

  it("shows this month's payments by default with visit date, patient, visit total, paid and remaining", async () => {
    const api = fakePayments()
    renderReports()

    await screen.findByRole('table')
    expect(api).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31', page: 1 })
    expect(periodButton('This month')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 Oct 2026 – 31 Oct 2026')).toBeInTheDocument()

    const rows = bodyRows()
    expect(rows).toHaveLength(4)
    expect(cellTexts(rows[0])).toEqual(['5 Oct 2026', 'Mona Ali', 'EGP 1,500.00', 'EGP 1,000.00', 'EGP 500.00', 'Amal Saad'])
  })

  it("links each patient to the patient's page", async () => {
    fakePayments()
    vi.spyOn(patientsApi, 'getPatient').mockReturnValue(new Promise(() => {}))
    renderReports()

    await screen.findByRole('table')
    const link = within(bodyRows()[0]).getByRole('link', { name: 'Mona Ali' })
    expect(link).toHaveAttribute('href', '/doctor/patients/1')
    await userEvent.click(link)
    await expectPath('/doctor/patients/1')
  })

  it('shows when an installment was paid on another day than the visit', async () => {
    fakePayments()
    renderReports()
    await screen.findByRole('table')

    const [mona, ahmedLater, ahmedSameDay] = bodyRows()
    expect(cellTexts(ahmedLater)).toEqual(['3 Oct 2026', 'Ahmed Hassan', 'EGP 800.00', 'EGP 200.00paid on 5 Oct 2026', 'EGP 300.00', '—'])
    expect(within(mona).queryByText(/paid on/)).not.toBeInTheDocument()
    expect(within(ahmedSameDay).queryByText(/paid on/)).not.toBeInTheDocument()
  })

  it('ends with a totals row for the whole range', async () => {
    fakePayments()
    renderReports()
    await screen.findByRole('table')

    expect(cellTexts(totalsRow())).toEqual(['Total', '', '', 'EGP 2,100.00', 'EGP 800.00', ''])
  })

  it('updates the table and totals when the period changes, and keeps it in the URL', async () => {
    const api = fakePayments()
    renderReports()
    await screen.findByRole('table')

    await userEvent.click(periodButton('Today'))
    expect(await screen.findByText('5 Oct 2026', { selector: 'p' })).toBeInTheDocument()
    expect(api).toHaveBeenLastCalledWith({ from: '2026-10-05', to: '2026-10-05', page: 1 })
    expect(bodyRows()).toHaveLength(1)
    expect(within(totalsRow()).getAllByRole('cell')[3]).toHaveTextContent('EGP 1,000.00')

    await userEvent.click(periodButton('This week'))
    expect(await screen.findByText('3 Oct 2026 – 9 Oct 2026')).toBeInTheDocument()
    expect(api).toHaveBeenLastCalledWith({ from: '2026-10-03', to: '2026-10-09', page: 1 })
    expect(within(totalsRow()).getAllByRole('cell')[3]).toHaveTextContent('EGP 1,500.00')
  })

  it('opens on the period from the URL', async () => {
    const api = fakePayments()
    renderReports('/doctor/reports?period=week')

    await screen.findByRole('table')
    expect(periodButton('This week')).toHaveAttribute('aria-pressed', 'true')
    expect(api).toHaveBeenCalledWith({ from: '2026-10-03', to: '2026-10-09', page: 1 })
  })

  it('filters by a custom range from the URL and from the date inputs', async () => {
    const api = fakePayments()
    renderReports('/doctor/reports?period=custom&from=2026-09-01&to=2026-10-02')

    await screen.findByRole('table')
    expect(api).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-10-02', page: 1 })
    expect(bodyRows()).toHaveLength(2)
    expect(within(totalsRow()).getAllByRole('cell')[3]).toHaveTextContent('EGP 700.00')

    const fromInput = screen.getByLabelText('From')
    await userEvent.clear(fromInput)
    await userEvent.type(fromInput, '2026-10-01')
    expect(api).toHaveBeenLastCalledWith({ from: '2026-10-01', to: '2026-10-02', page: 1 })
    expect(await screen.findByText('EGP 600.00', { selector: 'tfoot td' })).toBeInTheDocument()
  })

  it('switching to Custom range starts from the range on screen', async () => {
    fakePayments()
    renderReports('/doctor/reports?period=week')
    await screen.findByRole('table')

    await userEvent.click(periodButton('Custom range'))

    expect(screen.getByLabelText('From')).toHaveValue('2026-10-03')
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-09')
  })

  it('does not ask the server when the end is before the start', async () => {
    const api = fakePayments()
    renderReports('/doctor/reports?period=custom&from=2026-10-10&to=2026-10-01')

    expect(await screen.findByRole('alert')).toHaveTextContent('The end date cannot be before the start date.')
    expect(api).not.toHaveBeenCalled()
  })

  it('says so when there are no payments in the period', async () => {
    fakePayments()
    renderReports('/doctor/reports?period=custom&from=2026-08-01&to=2026-08-31')

    expect(await screen.findByText('No payments in this period.')).toBeInTheDocument()
  })

  it('pages through the rows, keeping the period', async () => {
    const api = fakePayments({ perPage: 2 })
    renderReports('/doctor/reports?period=week')
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(api).toHaveBeenLastCalledWith({ from: '2026-10-03', to: '2026-10-09', page: 2 })
    expect(within(totalsRow()).getAllByRole('cell')[3]).toHaveTextContent('EGP 1,500.00') // still the whole week
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z'))
    vi.spyOn(reportsApi, 'getDailyRevenue').mockResolvedValue([])
  })

  afterEach(() => vi.useRealTimers())

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    fakePayments()
    await expectNoA11yViolationsInBothLanguages(() => renderReports())
  })
})
