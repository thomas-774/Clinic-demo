import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as api from '../../api/settings'
import { renderAppAt } from '../../test/renderApp'
import { errorToasts, expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

/** Sat–Thu 17:00–21:00, Friday off — like the seeder. */
function seededWeek() {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    ranges: day === 5 ? [] : [{ start_time: '17:00', end_time: '21:00' }],
  }))
}

/** In-memory server so a "reload" shows what was saved. */
function fakeServer() {
  const state = {
    settings: { slot_duration_minutes: 45, booking_window_days: 30, cancel_cutoff_hours: 2 },
    week: seededWeek(),
  }
  vi.spyOn(api, 'getSettings').mockImplementation(async () => state.settings)
  vi.spyOn(api, 'getWorkingHours').mockImplementation(async () => state.week)
  vi.spyOn(api, 'getBlockedTimes').mockResolvedValue([])
  vi.spyOn(api, 'getStaff').mockResolvedValue([])
  return {
    state,
    updateSettings: vi.spyOn(api, 'updateSettings').mockImplementation(async (fields) => (state.settings = fields)),
    updateHours: vi.spyOn(api, 'updateWorkingHours').mockImplementation(async (days) => (state.week = days)),
  }
}

function renderSettings() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/settings')
}

const day = (name) => screen.getByRole('listitem', { name })

describe('Settings: hours and duration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows the week starting on Saturday, with Friday off', async () => {
    fakeServer()
    renderSettings()

    const items = await screen.findAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    ])
    expect(within(day('Friday')).getByText('Day off')).toBeInTheDocument()
    expect(within(day('Tuesday')).getByLabelText('Tuesday range 1 start')).toHaveValue('17:00')
    expect(screen.getByLabelText('Appointment length')).toHaveValue('45')
  })

  it('adds a break, changes duration and cut-off, and keeps them after a reload', async () => {
    const server = fakeServer()
    renderSettings()
    await screen.findAllByRole('listitem')

    // Tuesday: add a morning range 10:00–13:00 next to 17:00–21:00.
    await userEvent.click(screen.getByRole('button', { name: 'Add range on Tuesday' }))
    fireEvent.change(screen.getByLabelText('Tuesday range 2 start'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Tuesday range 2 end'), { target: { value: '13:00' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save working hours' }))
    expect(await screen.findByText('Working hours saved.')).toBeInTheDocument()
    expect(server.updateHours.mock.calls[0][0][2].ranges).toEqual([
      { start_time: '17:00', end_time: '21:00' },
      { start_time: '10:00', end_time: '13:00' },
    ])

    await userEvent.selectOptions(screen.getByLabelText('Appointment length'), '60')
    const cutoff = screen.getByLabelText('Cancellation cut-off (hours)')
    await userEvent.clear(cutoff)
    await userEvent.type(cutoff, '24')
    await userEvent.click(screen.getByRole('button', { name: 'Save appointment settings' }))
    expect(await screen.findByText('Appointment settings saved.')).toBeInTheDocument()
    expect(server.updateSettings).toHaveBeenCalledWith({ slot_duration_minutes: 60, booking_window_days: 30, cancel_cutoff_hours: 24 })

    // Reload the page.
    cleanup()
    server.state.week[2].ranges.sort((a, b) => a.start_time.localeCompare(b.start_time)) // the API returns ranges sorted
    renderSettings()
    await screen.findAllByRole('listitem')
    expect(screen.getByLabelText('Appointment length')).toHaveValue('60')
    expect(screen.getByLabelText('Cancellation cut-off (hours)')).toHaveValue(24)
    expect(screen.getByLabelText('Tuesday range 1 start')).toHaveValue('10:00')
    expect(screen.getByLabelText('Tuesday range 2 start')).toHaveValue('17:00')
  })

  it('makes a day a day off by removing its only range', async () => {
    const server = fakeServer()
    renderSettings()
    await screen.findAllByRole('listitem')

    await userEvent.click(screen.getByRole('button', { name: 'Remove Monday range 1' }))
    expect(within(day('Monday')).getByText('Day off')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save working hours' }))

    expect(await screen.findByText('Working hours saved.')).toBeInTheDocument()
    expect(server.updateHours.mock.calls[0][0][1].ranges).toEqual([])
  })

  it('accepts a custom duration', async () => {
    const server = fakeServer()
    renderSettings()
    await screen.findAllByRole('listitem')

    await userEvent.selectOptions(screen.getByLabelText('Appointment length'), 'custom')
    const custom = screen.getByLabelText('Length in minutes')
    await userEvent.clear(custom)
    await userEvent.type(custom, '50')
    await userEvent.click(screen.getByRole('button', { name: 'Save appointment settings' }))

    await screen.findByText('Appointment settings saved.')
    expect(server.updateSettings.mock.calls[0][0].slot_duration_minutes).toBe(50)
  })

  it('shows 422 errors next to the range and an error toast', async () => {
    fakeServer()
    vi.spyOn(api, 'updateWorkingHours').mockRejectedValue(
      new AxiosError('x', '422', {}, null, {
        status: 422,
        data: { errors: { 'days.2.ranges.0.end_time': ['The end time field must be a date after start time.'] } },
      }),
    )
    renderSettings()
    await screen.findAllByRole('listitem')

    await userEvent.click(screen.getByRole('button', { name: 'Save working hours' }))

    expect(await within(day('Tuesday')).findByText('The end time field must be a date after start time.')).toBeInTheDocument()
    expect(within(day('Tuesday')).getByLabelText('Tuesday range 1 end')).toHaveAttribute('aria-invalid', 'true')
    expect(errorToasts()).toHaveTextContent('Please fix the highlighted fields.')
  })
})

describe('Settings: live slot preview', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  const preview = (dayName) => screen.getByRole('group', { name: `Slots on ${dayName}` })
  const chips = (dayName) => within(preview(dayName)).queryAllByTestId('preview-slot').map((chip) => chip.textContent)

  it('shows the slots each working day would produce, and none for a day off', async () => {
    fakeServer()
    renderSettings()
    await screen.findAllByRole('listitem')

    expect(chips('Saturday')).toEqual(['17:00', '17:45', '18:30', '19:15', '20:00'])
    expect(preview('Saturday')).toHaveTextContent('5 slots')
    expect(screen.queryByRole('group', { name: 'Slots on Friday' })).not.toBeInTheDocument()
  })

  it('updates instantly when the duration changes, before saving', async () => {
    const server = fakeServer()
    renderSettings()
    await screen.findAllByRole('listitem')

    await userEvent.selectOptions(screen.getByLabelText('Appointment length'), '60')

    expect(chips('Saturday')).toEqual(['17:00', '18:00', '19:00', '20:00'])
    expect(server.updateSettings).not.toHaveBeenCalled()
  })

  it('updates when a break is added to a day', async () => {
    fakeServer()
    renderSettings()
    await screen.findAllByRole('listitem')
    await userEvent.selectOptions(screen.getByLabelText('Appointment length'), '60')

    await userEvent.click(screen.getByRole('button', { name: 'Add range on Tuesday' }))
    fireEvent.change(screen.getByLabelText('Tuesday range 2 start'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Tuesday range 2 end'), { target: { value: '13:00' } })

    expect(chips('Tuesday')).toEqual(['10:00', '11:00', '12:00', '17:00', '18:00', '19:00', '20:00'])
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    fakeServer()
    await expectNoA11yViolationsInBothLanguages(renderSettings)
  })
})
