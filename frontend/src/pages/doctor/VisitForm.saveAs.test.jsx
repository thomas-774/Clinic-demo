import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as appointmentsApi from '../../api/appointments'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as patientsApi from '../../api/doctorPatients'
import * as visitsApi from '../../api/visits'
import { expectPath, renderAppAt } from '../../test/renderApp'

// "Also save as: None · PDF · Word" next to Save (FR-K.1, T10-08).

const MONA = { id: 7, name: 'Mona Ali', phone: '01011112222' }
const APPOINTMENT = {
  id: 40,
  start_at: '2026-10-05T17:00:00+03:00',
  end_at: '2026-10-05T17:45:00+03:00',
  status: 'checked_in',
  patient: MONA,
}

function fakeServer() {
  vi.spyOn(appointmentsApi, 'getSchedule').mockResolvedValue([APPOINTMENT])
  vi.spyOn(patientsApi, 'getPatient').mockResolvedValue({ ...MONA, address: 'Cairo', history: [], visits: [], outstanding_balance: '0.00' })
  const create = vi.spyOn(visitsApi, 'createVisit').mockImplementation(async (fields) => ({
    id: 88,
    total_amount: '800.00',
    paid: '800.00',
    remaining: '0.00',
    payment_status: 'paid',
    ...fields,
  }))
  const exportVisit = vi.spyOn(visitsApi, 'exportVisit').mockResolvedValue({
    data: new Blob(['%PDF'], { type: 'application/pdf' }),
    headers: { 'content-disposition': 'attachment; filename="visit-2026-10-05-88.pdf"' },
  })
  return { create, exportVisit }
}

function renderForm() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/visits/new?appointment=40')
}

async function fillAndSave(buttonName) {
  await userEvent.type(await screen.findByLabelText('Work done today'), 'Extraction')
  await userEvent.type(screen.getByLabelText('Total cost'), '800')
  await userEvent.type(screen.getByLabelText('Amount paid now'), '800')
  await userEvent.click(screen.getByRole('button', { name: buttonName }))
}

describe('VisitForm — Also save as', () => {
  let saved

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z'))
    saved = []
    URL.createObjectURL = vi.fn(() => 'blob:visit')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      saved.push(this.download)
    })
  })

  afterEach(() => vi.useRealTimers())

  it('defaults to None and is a labelled radio group', async () => {
    fakeServer()
    renderForm()

    const group = await screen.findByRole('group', { name: 'Also save as' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'None' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'PDF' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Word' })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save visit' })).toBeInTheDocument()
  })

  it('remembers the choice on this computer and names it on the Save button', async () => {
    fakeServer()
    const { unmount } = renderForm()

    await userEvent.click(await screen.findByRole('radio', { name: 'Word' }))
    expect(screen.getByRole('button', { name: 'Save visit + Word' })).toBeInTheDocument()
    expect(localStorage.getItem('clinic.visitFile')).toBe('docx')

    // Arrow keys move the choice, as in any radio group.
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'PDF' })).toBeChecked()
    expect(localStorage.getItem('clinic.visitFile')).toBe('pdf')
    unmount()

    renderForm()
    expect(await screen.findByRole('radio', { name: 'PDF' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save visit + PDF' })).toBeInTheDocument()
  })

  it('falls back to None when storage throws, and still lets the doctor choose', async () => {
    fakeServer()
    localStorage.setItem('clinic.visitFile', 'pdf')
    // Only this key is blocked, so the login token still loads.
    const { getItem, setItem } = Storage.prototype
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
      if (key === 'clinic.visitFile') throw new Error('blocked')
      return getItem.call(this, key)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'clinic.visitFile') throw new Error('blocked')
      return setItem.call(this, key, value)
    })
    renderForm()

    expect(await screen.findByRole('radio', { name: 'None' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Word' }))
    expect(screen.getByRole('radio', { name: 'Word' })).toBeChecked()
  })

  it('ignores an unknown stored value', async () => {
    fakeServer()
    localStorage.setItem('clinic.visitFile', 'xls')
    renderForm()

    expect(await screen.findByRole('radio', { name: 'None' })).toBeChecked()
  })

  it('Save + PDF creates the visit, downloads its PDF once, then opens the patient page', async () => {
    const { create, exportVisit } = fakeServer()
    localStorage.setItem('clinic.visitFile', 'pdf')
    renderForm()

    await fillAndSave('Save visit + PDF')

    await expectPath('/doctor/patients/7')
    expect(exportVisit).toHaveBeenCalledTimes(1)
    expect(exportVisit).toHaveBeenCalledWith(88, 'pdf')
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(exportVisit.mock.invocationCallOrder[0])
    expect(saved).toEqual(['visit-2026-10-05-88.pdf'])
    expect(await screen.findByText('Visit saved. Remaining: EGP 0.00')).toBeInTheDocument()
    expect(screen.getByText('PDF saved.')).toBeInTheDocument()
  })

  it('a failed download still opens the patient page and shows the warning', async () => {
    const { exportVisit } = fakeServer()
    exportVisit.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'))
    localStorage.setItem('clinic.visitFile', 'docx')
    renderForm()

    await fillAndSave('Save visit + Word')

    await expectPath('/doctor/patients/7')
    expect(exportVisit).toHaveBeenCalledWith(88, 'docx')
    expect(await screen.findByText('Visit saved, but the file could not be downloaded — use the PDF / Word buttons on the visit.')).toBeInTheDocument()
    expect(screen.getByText('Visit saved. Remaining: EGP 0.00')).toBeInTheDocument()
    expect(screen.queryByText('The file could not be downloaded. Please try again.')).not.toBeInTheDocument()
  })

  it('None never asks for a file', async () => {
    const { create, exportVisit } = fakeServer()
    renderForm()

    await fillAndSave('Save visit')

    await expectPath('/doctor/patients/7')
    expect(create).toHaveBeenCalledTimes(1)
    expect(exportVisit).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })
})
