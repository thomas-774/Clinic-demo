import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as appointmentsApi from '../../api/appointments'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as slotsApi from '../../api/slots'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const appt = (id, date, time, end, status, canCancel = false) => ({
  id,
  start_at: `${date}T${time}:00+03:00`,
  end_at: `${date}T${end}:00+03:00`,
  status,
  checked_in_at: null,
  cancelled_at: null,
  can_cancel: canCancel,
})

/** In-memory server: cancelling moves the appointment to "past" and frees its slot. */
function fakeServer({ upcoming, past = [] }) {
  const state = { upcoming: [...upcoming], past: [...past], freed: [] }
  vi.spyOn(appointmentsApi, 'getMyAppointments').mockImplementation(async () => ({ upcoming: state.upcoming, past: state.past }))
  const cancel = vi.spyOn(appointmentsApi, 'cancelMyAppointment').mockImplementation(async (id) => {
    const appointment = state.upcoming.find((a) => a.id === id)
    state.upcoming = state.upcoming.filter((a) => a.id !== id)
    const cancelled = { ...appointment, status: 'cancelled', can_cancel: false }
    state.past = [cancelled, ...state.past]
    state.freed.push({ start_at: appointment.start_at, end_at: appointment.end_at })
    return cancelled
  })
  vi.spyOn(slotsApi, 'getSlots').mockImplementation(async (date) => ({
    data: state.freed.filter((s) => s.start_at.startsWith(date)),
    meta: { date, duration: 45, booking_window_days: 30 },
  }))
  return { cancel }
}

function renderMine() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 5, name: 'Mona Ali', role: 'patient', patient_id: 1 })
  return renderAppAt('/patient/appointments')
}

describe('MyAppointments', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('shows upcoming and past appointments with date, time and status', async () => {
    fakeServer({
      upcoming: [appt(3, '2026-10-06', '17:00', '17:45', 'booked', true)],
      past: [appt(2, '2026-09-20', '18:30', '19:15', 'completed'), appt(1, '2026-09-10', '17:00', '17:45', 'no_show')],
    })
    renderMine()

    const upcoming = await screen.findByRole('list', { name: 'Upcoming' })
    expect(upcoming).toHaveTextContent('6 Oct 2026')
    expect(upcoming).toHaveTextContent('17:00 – 17:45')
    expect(upcoming).toHaveTextContent('Booked')

    const past = within(screen.getByRole('list', { name: 'Past' })).getAllByRole('listitem')
    expect(past[0]).toHaveTextContent('20 Sept 2026')
    expect(past[0]).toHaveTextContent('Completed')
    expect(past[1]).toHaveTextContent('No-show')
  })

  it('replaces the cancel button with a call-the-clinic note after the cut-off', async () => {
    fakeServer({ upcoming: [appt(3, '2026-10-05', '09:00', '09:45', 'booked', false)] })
    renderMine()

    expect(await screen.findByText('Too late to cancel online — please call the clinic.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument()
  })

  it('shows no cancel action on a checked-in appointment', async () => {
    fakeServer({ upcoming: [appt(3, '2026-10-05', '07:30', '08:15', 'checked_in')] })
    renderMine()

    expect(await screen.findByText('Checked in')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Too late to cancel/)).not.toBeInTheDocument()
  })

  it('cancels after confirming; the freed slot can be booked again', async () => {
    const { cancel } = fakeServer({ upcoming: [appt(3, '2026-10-05', '17:00', '17:45', 'booked', true)] })
    renderMine()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel this appointment?' })
    expect(dialog).toHaveTextContent('5 Oct 2026 at 17:00')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel it' }))

    expect(cancel).toHaveBeenCalledWith(3)
    expect(await screen.findByText('Appointment cancelled.')).toBeInTheDocument()
    expect(await screen.findByText('You have no upcoming appointments.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Past' })).getByText('Cancelled')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Book an appointment' }))
    await expectPath('/patient/book')
    expect(await screen.findByRole('button', { name: '17:00' })).toBeInTheDocument()
  })

  it('keeps the appointment when the dialog is dismissed', async () => {
    const { cancel } = fakeServer({ upcoming: [appt(3, '2026-10-06', '17:00', '17:45', 'booked', true)] })
    renderMine()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(cancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancel appointment' })).toBeInTheDocument()
  })

  it('shows empty states', async () => {
    fakeServer({ upcoming: [] })
    renderMine()

    expect(await screen.findByText('You have no upcoming appointments.')).toBeInTheDocument()
    expect(screen.getByText('No past appointments.')).toBeInTheDocument()
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    fakeServer({
      upcoming: [appt(3, '2026-10-06', '17:00', '17:45', 'booked', true)],
      past: [appt(2, '2026-09-20', '18:30', '19:15', 'completed'), appt(1, '2026-09-10', '17:00', '17:45', 'no_show')],
    })
    await expectNoA11yViolationsInBothLanguages(renderMine)
  })
})
