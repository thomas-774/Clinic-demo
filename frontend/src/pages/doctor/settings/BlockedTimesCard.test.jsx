import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../../api/auth'
import { tokenStorage } from '../../../api/client'
import * as api from '../../../api/settings'
import { renderAppAt } from '../../../test/renderApp'

function fakeServer(initial = []) {
  let blocks = [...initial]
  let nextId = 100
  vi.spyOn(api, 'getStaff').mockResolvedValue([])
  vi.spyOn(api, 'getSettings').mockResolvedValue({ slot_duration_minutes: 45, booking_window_days: 30, cancel_cutoff_hours: 2 })
  vi.spyOn(api, 'getWorkingHours').mockResolvedValue([0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, ranges: [] })))
  vi.spyOn(api, 'getBlockedTimes').mockImplementation(async () => blocks)
  return {
    add: vi.spyOn(api, 'addBlockedTime').mockImplementation(async (fields) => {
      const block = { id: nextId++, ...fields, whole_day: !fields.start_time }
      blocks = [...blocks, block]
      return block
    }),
    remove: vi.spyOn(api, 'deleteBlockedTime').mockImplementation(async (id) => {
      blocks = blocks.filter((b) => b.id !== id)
      return {}
    }),
  }
}

function renderSettings() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/settings')
}

describe('Settings: blocked dates', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists upcoming blocks with their time range or "whole day"', async () => {
    fakeServer([
      { id: 1, date: '2026-10-06', whole_day: true, start_time: null, end_time: null, reason: 'Holiday' },
      { id: 2, date: '2026-10-07', whole_day: false, start_time: '18:00', end_time: '19:00', reason: null },
    ])
    renderSettings()

    const list = await screen.findByRole('list', { name: 'Upcoming blocks' })
    const [first, second] = within(list).getAllByRole('listitem')
    expect(first).toHaveTextContent('6 Oct 2026')
    expect(first).toHaveTextContent('Whole day')
    expect(first).toHaveTextContent('Holiday')
    expect(second).toHaveTextContent('18:00 – 19:00')
  })

  it('adds a whole-day holiday', async () => {
    const server = fakeServer()
    renderSettings()
    expect(await screen.findByText('No upcoming blocks.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-06' } })
    await userEvent.type(screen.getByLabelText('Reason (optional)'), 'Holiday')
    await userEvent.click(screen.getByRole('button', { name: 'Add block' }))

    expect(await screen.findByText('Time blocked.')).toBeInTheDocument()
    expect(server.add).toHaveBeenCalledWith({ date: '2026-10-06', start_time: null, end_time: null, reason: 'Holiday' })
    expect(await screen.findByText('Holiday')).toBeInTheDocument()
  })

  it('adds a time-range block', async () => {
    const server = fakeServer()
    renderSettings()
    await screen.findByText('No upcoming blocks.')

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-07' } })
    await userEvent.click(screen.getByLabelText('Whole day'))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '19:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add block' }))

    await waitFor(() =>
      expect(server.add).toHaveBeenCalledWith({ date: '2026-10-07', start_time: '18:00', end_time: '19:00', reason: null }),
    )
    expect(await screen.findByText('18:00 – 19:00')).toBeInTheDocument()
  })

  it('shows validation errors under the fields', async () => {
    fakeServer()
    vi.spyOn(api, 'addBlockedTime').mockRejectedValue(
      new AxiosError('x', '422', {}, null, { status: 422, data: { errors: { date: ['The date field must be a date after or equal to today.'] } } }),
    )
    renderSettings()
    await screen.findByText('No upcoming blocks.')

    await userEvent.click(screen.getByRole('button', { name: 'Add block' }))

    expect(await screen.findByText('The date field must be a date after or equal to today.')).toBeInTheDocument()
  })

  it('deletes a block after confirmation', async () => {
    const server = fakeServer([{ id: 1, date: '2026-10-06', whole_day: true, start_time: null, end_time: null, reason: 'Holiday' }])
    renderSettings()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete block on 6 Oct 2026' }))
    const dialog = screen.getByRole('dialog', { name: 'Remove this block?' })
    expect(dialog).toHaveTextContent('6 Oct 2026 (Whole day) will be open for booking again.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('No upcoming blocks.')).toBeInTheDocument()
    expect(server.remove).toHaveBeenCalledWith(1)
  })
})
