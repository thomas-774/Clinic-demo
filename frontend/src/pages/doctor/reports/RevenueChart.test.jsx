import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../../../api/auth'
import { tokenStorage } from '../../../api/client'
import * as reportsApi from '../../../api/reports'
import { renderAppAt } from '../../../test/renderApp'

/** Like GET /doctor/reports/daily-revenue: every day of the month, 0.00 on quiet days. */
function month(ym, revenueByDay = {}) {
  const days = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).getUTCDate()
  return Array.from({ length: days }, (_, i) => {
    const date = `${ym}-${String(i + 1).padStart(2, '0')}`
    return { date, revenue: revenueByDay[i + 1] ?? '0.00' }
  })
}

const OCTOBER = month('2026-10', { 1: '600.00', 3: '300.00', 5: '1200.00' })

function renderReports(path = '/doctor/reports') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  vi.spyOn(reportsApi, 'getReportPayments').mockResolvedValue({
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0, range: {}, totals: { count: 0, paid: '0.00', remaining: '0.00' } },
  })
  return renderAppAt(path)
}

const chartSection = () => screen.getByRole('heading', { name: 'Revenue per day' }).closest('section')

describe('Reports: daily revenue chart', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z')) // Monday 17:20 in Cairo
    // jsdom has no layout: give elements a size so ResponsiveContainer draws the chart.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 280, width: 800, height: 280 })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(280)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(280)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('draws one bar per day of this month from the endpoint, with the month total', async () => {
    const api = vi.spyOn(reportsApi, 'getDailyRevenue').mockResolvedValue(OCTOBER)
    const { container } = renderReports()

    const chart = await screen.findByRole('img', { name: /revenue per day/i })
    expect(api).toHaveBeenCalledWith('2026-10')
    expect(screen.getByLabelText('Month')).toHaveValue('2026-10')
    expect(chart).toHaveAccessibleName(/^Bar chart of revenue per day\. Month total EGP\s2,100\.00\.$/)
    expect(within(chartSection()).getByText('EGP 2,100.00')).toBeInTheDocument()
    // Recharts draws a rectangle for each non-zero day.
    expect(container.querySelectorAll('.recharts-bar-rectangle path')).toHaveLength(3)
  })

  it('shows the same numbers as a table', async () => {
    vi.spyOn(reportsApi, 'getDailyRevenue').mockResolvedValue(OCTOBER)
    renderReports()
    await screen.findByRole('img', { name: /revenue per day/i })

    await userEvent.click(screen.getByRole('button', { name: 'Show as table' }))

    const rows = within(within(chartSection()).getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(31)
    const text = (row) => row.textContent.replace(/\s/g, ' ')
    expect(text(rows[0])).toBe('1 Oct 2026EGP 600.00')
    expect(text(rows[1])).toBe('2 Oct 2026EGP 0.00')
    expect(text(rows[4])).toBe('5 Oct 2026EGP 1,200.00')
    await userEvent.click(screen.getByRole('button', { name: 'Hide table' }))
    expect(within(chartSection()).queryByRole('table')).not.toBeInTheDocument()
  })

  it('loads another month from the month picker and keeps it in the URL', async () => {
    const api = vi
      .spyOn(reportsApi, 'getDailyRevenue')
      .mockImplementation(async (ym) => (ym === '2026-09' ? month('2026-09', { 28: '100.00' }) : OCTOBER))
    renderReports('/doctor/reports?period=week')
    await screen.findByRole('img', { name: /revenue per day/i })

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-09' } })

    expect(await screen.findByRole('img', { name: /Month total EGP\s100\.00\./ })).toBeInTheDocument()
    expect(api).toHaveBeenLastCalledWith('2026-09')
    // The table's period is untouched.
    expect(within(screen.getByRole('group', { name: 'Period' })).getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens on ?month= from the URL', async () => {
    const api = vi.spyOn(reportsApi, 'getDailyRevenue').mockResolvedValue(month('2026-02', { 3: '50.00' }))
    renderReports('/doctor/reports?month=2026-02')

    await screen.findByRole('img', { name: /revenue per day/i })
    expect(api).toHaveBeenCalledWith('2026-02')
    expect(screen.getByLabelText('Month')).toHaveValue('2026-02')
  })

  it('shows an empty state for a month with no payments', async () => {
    vi.spyOn(reportsApi, 'getDailyRevenue').mockResolvedValue(month('2026-08'))
    renderReports('/doctor/reports?month=2026-08')

    expect(await screen.findByText('No payments were received in this month.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /revenue per day/i })).not.toBeInTheDocument()
  })
})
