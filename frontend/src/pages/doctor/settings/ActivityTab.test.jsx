import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as auditLogsApi from '../../../api/auditLogs'
import * as authApi from '../../../api/auth'
import { tokenStorage } from '../../../api/client'
import * as patientsApi from '../../../api/doctorPatients'
import * as settingsApi from '../../../api/settings'
import i18next from '../../../i18n'
import { renderAppAt } from '../../../test/renderApp'

const ROW = {
  id: 1,
  created_at: '2026-10-07T10:30:00+03:00',
  action: 'updated',
  user: { id: 1, name: 'Dr. Doctor' },
  user_role: 'doctor',
  record: { type: 'visit', id: 12, label: 'Visit' },
  patient: { id: 7, name: 'Mona Ali' },
  changed_fields: [
    { name: 'work_done', label: 'Work done' },
    { name: 'total_amount', label: 'Total cost' },
  ],
  ip: '10.0.0.7',
}

function fakeServer(rows = [ROW], patient = null) {
  vi.spyOn(settingsApi, 'getStaff').mockResolvedValue([{ id: 2, name: 'Sara Hassan' }])
  vi.spyOn(patientsApi, 'listPatients').mockResolvedValue({
    data: [{ id: 7, name: 'Mona Ali', phone: '01011112222' }],
    meta: { current_page: 1, last_page: 1, total: 1 },
  })
  return vi.spyOn(auditLogsApi, 'listAuditLogs').mockImplementation(async ({ page }) => ({
    data: rows,
    meta: { current_page: page, last_page: 1, total: rows.length },
    filters: { patient },
  }))
}

function renderTab(path = '/doctor/settings?tab=activity') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt(path)
}

/** The filters of the last request. */
const lastQuery = (list) => list.mock.calls.at(-1)[0]

describe('Settings → Activity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists who did what, with the record, patient, field names and IP', async () => {
    fakeServer()
    renderTab()

    const table = await screen.findByRole('table')
    const row = within(table).getAllByRole('row')[1]
    expect(row).toHaveTextContent('Dr. Doctor')
    expect(row).toHaveTextContent('Doctor')
    expect(row).toHaveTextContent('Changed')
    expect(row).toHaveTextContent('Visit #12')
    expect(row).toHaveTextContent('Work done, Total cost')
    expect(row).toHaveTextContent('10.0.0.7')
    expect(within(row).getByRole('link', { name: 'Mona Ali' })).toHaveAttribute('href', '/doctor/patients/7')
    expect(screen.getByText('Entries: 1')).toBeInTheDocument()
  })

  it('builds the query from the user, action and date filters', async () => {
    const list = fakeServer()
    renderTab()
    await screen.findByRole('table')
    expect(lastQuery(list)).toEqual({ patientId: null, userId: '', action: '', from: '', to: '', page: 1 })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'User' }), 'Sara Hassan · Assistant')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Action' }), 'Printed')
    await userEvent.type(screen.getByLabelText('From'), '2026-10-01')
    await userEvent.type(screen.getByLabelText('To'), '2026-10-07')

    await waitFor(() =>
      expect(lastQuery(list)).toEqual({ patientId: null, userId: '2', action: 'printed', from: '2026-10-01', to: '2026-10-07', page: 1 }),
    )
  })

  it('filters by a patient picked from the search', async () => {
    const list = fakeServer()
    renderTab()
    await screen.findByRole('table')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Patient' }), 'mona')
    const matches = await screen.findByRole('list', { name: 'Matching patients' })
    await userEvent.click(within(matches).getByRole('button', { name: /Mona Ali/ }))

    await waitFor(() => expect(lastQuery(list).patientId).toBe(7))
    expect(screen.getByText('Mona Ali', { selector: 'span' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'All patients' }))
    await waitFor(() => expect(lastQuery(list).patientId).toBe(null))
  })

  it('opens filtered on the patient from "Activity on this patient", named by the server', async () => {
    const list = fakeServer([], { id: 7, name: 'Mona Ali' })
    renderTab('/doctor/settings?tab=activity&patient=7')

    expect(await screen.findByText('No activity matches these filters.')).toBeInTheDocument()
    expect(lastQuery(list).patientId).toBe(7)
    expect(screen.getByText('Mona Ali')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    fakeServer([])
    renderTab()

    expect(await screen.findByText('No activity matches these filters.')).toBeInTheDocument()
  })

  it('shows a load error with retry', async () => {
    vi.spyOn(settingsApi, 'getStaff').mockResolvedValue([])
    vi.spyOn(auditLogsApi, 'listAuditLogs').mockRejectedValue(new Error('down'))
    renderTab()

    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument()
  })

  it('is in Arabic with the Arabic labels', async () => {
    await i18next.changeLanguage('ar')
    fakeServer([{ ...ROW, changed_fields: [{ name: 'work_done', label: 'العمل المنجز' }, { name: 'total_amount', label: 'التكلفة الإجمالية' }] }])
    renderTab()

    const row = within(await screen.findByRole('table')).getAllByRole('row')[1]
    expect(row).toHaveTextContent('تعديل')
    expect(row).toHaveTextContent('العمل المنجز، التكلفة الإجمالية')
    expect(screen.getByRole('tab', { name: 'النشاط' })).toHaveAttribute('aria-selected', 'true')
  })
})
