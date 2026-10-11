import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as appointmentsApi from '../../api/appointments'
import * as assistantApi from '../../api/assistant'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as doctorPatientsApi from '../../api/doctorPatients'
import * as slotsApi from '../../api/slots'
import { renderAppAt } from '../../test/renderApp'

const MONA = { id: 1, name: 'Mona Ali', phone: '01011112222' }
const AHMED = { id: 2, name: 'Ahmed Hassan', phone: '01233334444' }

const appt = (id, day, time, end, patient, status = 'booked') => ({
  id,
  start_at: `${day}T${time}:00+03:00`,
  end_at: `${day}T${end}:00+03:00`,
  status,
  checked_in_at: null,
  cancelled_at: null,
  patient,
})

function renderSchedule(path = '/assistant/schedule') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 3, name: 'Amal Saad', role: 'assistant' })
  return renderAppAt(path)
}

const rowOf = (name) => screen.getByText(name).closest('li')

describe('Assistant: schedule', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z')) // Monday 08:00 in Cairo
  })

  afterEach(() => vi.useRealTimers())

  it('shows the day with Arrived / No-show / Cancel and no Start visit, through the assistant API', async () => {
    let rows = [appt(1, '2026-10-05', '17:00', '17:45', MONA, 'checked_in'), appt(2, '2026-10-05', '18:30', '19:15', AHMED)]
    const schedule = vi.spyOn(assistantApi, 'getSchedule').mockImplementation(async () => rows)
    const update = vi.spyOn(assistantApi, 'updateAppointmentStatus').mockImplementation(async (id, status) => {
      rows = rows.map((row) => (row.id === id ? { ...row, status } : row))
      return rows.find((row) => row.id === id)
    })
    const doctorSchedule = vi.spyOn(appointmentsApi, 'getSchedule')

    renderSchedule()

    expect(await screen.findByRole('heading', { name: 'Schedule' })).toBeInTheDocument()
    await screen.findByText('Mona Ali')
    expect(schedule).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-05' })
    expect(doctorSchedule).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Start visit' })).not.toBeInTheDocument()
    expect(within(rowOf('Mona Ali')).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    await userEvent.click(within(rowOf('Ahmed Hassan')).getByRole('button', { name: 'No-show' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, no-show' }))
    expect(update).toHaveBeenCalledWith(2, 'no_show')
    expect(await within(rowOf('Ahmed Hassan')).findByText('No-show')).toHaveAttribute('data-status', 'no_show')
  })

  it('shows the week from the assistant API', async () => {
    const schedule = vi.spyOn(assistantApi, 'getSchedule').mockResolvedValue([appt(1, '2026-10-07', '17:00', '17:45', MONA)])

    renderSchedule('/assistant/schedule?view=week')

    expect(await screen.findByText('Mona Ali')).toBeInTheDocument()
    expect(schedule).toHaveBeenCalledWith({ from: '2026-10-03', to: '2026-10-09' })
  })

  it('books for a patient with the assistant patient search and booking', async () => {
    vi.spyOn(assistantApi, 'getSchedule').mockResolvedValue([])
    const search = vi.spyOn(assistantApi, 'listPatients').mockResolvedValue({ data: [MONA], meta: { current_page: 1, last_page: 1, total: 1 } })
    const doctorSearch = vi.spyOn(doctorPatientsApi, 'listPatients')
    vi.spyOn(slotsApi, 'getSlots').mockResolvedValue({ data: [{ start_at: '2026-10-05T17:00:00+03:00', end_at: '2026-10-05T17:45:00+03:00' }] })
    const book = vi.spyOn(assistantApi, 'bookForPatient').mockResolvedValue({ id: 9 })

    renderSchedule()
    await userEvent.click(await screen.findByRole('button', { name: 'Book for patient' }))
    const dialog = await screen.findByRole('dialog', { name: 'Book for patient' })

    await userEvent.click(await within(dialog).findByRole('button', { name: /Mona Ali/ }))
    await userEvent.click(await within(dialog).findByRole('button', { name: /17:00/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Book' }))

    expect(search).toHaveBeenCalled()
    expect(doctorSearch).not.toHaveBeenCalled()
    expect(book).toHaveBeenCalledWith({ patient_id: 1, start_at: '2026-10-05T17:00:00+03:00' })
  })
})
