import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as appointmentsApi from '../../api/appointments'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as patientsApi from '../../api/doctorPatients'
import * as slotsApi from '../../api/slots'
import * as visitsApi from '../../api/visits'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const MONA = { id: 1, name: 'Mona Ali', phone: '01011112222' }
const AHMED = { id: 2, name: 'Ahmed Hassan', phone: '01233334444' }

const appt = (id, date, time, end, patient, status = 'booked') => ({
  id,
  start_at: `${date}T${time}:00+03:00`,
  end_at: `${date}T${end}:00+03:00`,
  status,
  checked_in_at: null,
  cancelled_at: null,
  patient,
})

/** In-memory schedule; status changes and bookings update it like the API. */
function fakeServer(rows = []) {
  let appointments = [...rows]
  let nextId = 100
  const getSchedule = vi
    .spyOn(appointmentsApi, 'getSchedule')
    .mockImplementation(async ({ from, to }) =>
      appointments.filter((a) => a.start_at.slice(0, 10) >= from && a.start_at.slice(0, 10) <= to).sort((a, b) => a.start_at.localeCompare(b.start_at)),
    )
  const updateStatus = vi.spyOn(appointmentsApi, 'updateAppointmentStatus').mockImplementation(async (id, status) => {
    appointments = appointments.map((a) => (a.id === id ? { ...a, status } : a))
    return appointments.find((a) => a.id === id)
  })
  vi.spyOn(patientsApi, 'listPatients').mockImplementation(async ({ search = '' }) => ({
    data: [MONA, AHMED].filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    meta: { current_page: 1, last_page: 1, total: 2 },
  }))
  vi.spyOn(slotsApi, 'getSlots').mockImplementation(async (date) => ({
    data: [{ start_at: `${date}T18:30:00+03:00`, end_at: `${date}T19:15:00+03:00` }],
    meta: { date, duration: 45, booking_window_days: 30 },
  }))
  const book = vi.spyOn(appointmentsApi, 'bookForPatient').mockImplementation(async ({ patient_id, start_at }) => {
    const patient = [MONA, AHMED].find((p) => p.id === patient_id)
    const created = { ...appt(nextId++, start_at.slice(0, 10), start_at.slice(11, 16), '19:15', patient) }
    appointments = [...appointments, created]
    return created
  })
  // Saving a visit completes its appointment, like POST /doctor/visits.
  const createVisit = vi.spyOn(visitsApi, 'createVisit').mockImplementation(async (fields) => {
    appointments = appointments.map((a) => (a.id === fields.appointment_id ? { ...a, status: 'completed' } : a))
    return { id: 88, ...fields, paid: fields.paid_now, remaining: '0.00', payment_status: 'paid', payments: [] }
  })
  vi.spyOn(patientsApi, 'getPatient').mockImplementation(async (id) => ({
    ...[MONA, AHMED].find((p) => p.id === Number(id)),
    email: null,
    address: 'Cairo',
    date_of_birth: null,
    gender: null,
    current_illness: null,
    history: [],
    visits: [],
    outstanding_balance: '0.00',
  }))
  return { getSchedule, updateStatus, book, createVisit }
}

function renderSchedule(path = '/doctor/schedule') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt(path)
}

const rowOf = (name) => screen.getByText(name).closest('li')

describe('Schedule: day view', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z')) // Monday 08:00 in Cairo
  })

  afterEach(() => vi.useRealTimers())

  it("lists today's appointments by time with name, phone and status", async () => {
    const server = fakeServer([
      appt(2, '2026-10-05', '18:30', '19:15', AHMED, 'checked_in'),
      appt(1, '2026-10-05', '17:00', '17:45', MONA),
      appt(3, '2026-10-06', '17:00', '17:45', MONA),
    ])
    renderSchedule()

    const list = await screen.findByRole('list', { name: 'Appointments' })
    const rows = within(list).getAllByRole('listitem')
    expect(server.getSchedule).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-05' })
    expect(screen.getByRole('heading', { name: 'Monday · 5 Oct 2026' })).toBeInTheDocument()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('17:00 – 17:45')
    expect(rows[0]).toHaveTextContent('Mona Ali')
    expect(rows[0]).toHaveTextContent('01011112222')
    expect(rows[0]).toHaveTextContent('Booked')
    expect(rows[1]).toHaveTextContent('Checked in')
  })

  it('shows Arrived, No-show and Cancel on booked rows; Start visit and Cancel on checked-in rows', async () => {
    fakeServer([
      appt(1, '2026-10-05', '17:00', '17:45', MONA),
      appt(2, '2026-10-05', '18:30', '19:15', AHMED, 'checked_in'),
      appt(3, '2026-10-05', '19:15', '20:00', { id: 3, name: 'Sara Adel', phone: '01155556666' }, 'completed'),
    ])
    renderSchedule()

    await screen.findByText('Mona Ali')
    expect(within(rowOf('Mona Ali')).getByRole('button', { name: 'Arrived' })).toBeInTheDocument()
    expect(within(rowOf('Mona Ali')).getByRole('button', { name: 'No-show' })).toBeInTheDocument()
    expect(within(rowOf('Mona Ali')).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(rowOf('Ahmed Hassan')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel'])
    expect(within(rowOf('Ahmed Hassan')).getByRole('link', { name: 'Start visit' })).toHaveAttribute('href', '/doctor/visits/new?appointment=2')
    expect(within(rowOf('Sara Adel')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(rowOf('Sara Adel')).queryByRole('link')).not.toBeInTheDocument()
  })

  it('cancels a checked-in appointment when the patient leaves without a visit', async () => {
    const server = fakeServer([appt(2, '2026-10-05', '18:30', '19:15', AHMED, 'checked_in')])
    renderSchedule()

    await userEvent.click(within(await screen.findByText('Ahmed Hassan').then((el) => el.closest('li'))).getByRole('button', { name: 'Cancel' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel this appointment?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel it' }))

    expect(server.updateStatus).toHaveBeenCalledWith(2, 'cancelled')
    expect(await within(rowOf('Ahmed Hassan')).findByText('Cancelled')).toBeInTheDocument()
    expect(within(rowOf('Ahmed Hassan')).queryByRole('link', { name: 'Start visit' })).not.toBeInTheDocument()
  })

  it('checks a patient in and the badge turns blue', async () => {
    const server = fakeServer([appt(1, '2026-10-05', '17:00', '17:45', MONA)])
    renderSchedule()

    await userEvent.click(await screen.findByRole('button', { name: 'Arrived' }))

    expect(server.updateStatus).toHaveBeenCalledWith(1, 'checked_in')
    expect(await screen.findByText('Mona Ali checked in.')).toBeInTheDocument()
    const badge = await within(rowOf('Mona Ali')).findByText('Checked in')
    expect(badge).toHaveAttribute('data-status', 'checked_in')
    expect(badge.className).toContain('bg-blue-100')
    expect(within(rowOf('Mona Ali')).queryByRole('button', { name: 'Arrived' })).not.toBeInTheDocument()
  })

  it('asks before marking a no-show or cancelling', async () => {
    const server = fakeServer([appt(1, '2026-10-05', '17:00', '17:45', MONA), appt(2, '2026-10-05', '18:30', '19:15', AHMED)])
    renderSchedule()

    await userEvent.click(within(await screen.findByText('Mona Ali').then((el) => el.closest('li'))).getByRole('button', { name: 'No-show' }))
    let dialog = screen.getByRole('dialog', { name: 'Mark as no-show?' })
    expect(dialog).toHaveTextContent('Mona Ali (17:00)')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, no-show' }))
    expect(server.updateStatus).toHaveBeenCalledWith(1, 'no_show')
    expect(await within(rowOf('Mona Ali')).findByText('No-show')).toHaveAttribute('data-status', 'no_show')

    await userEvent.click(within(rowOf('Ahmed Hassan')).getByRole('button', { name: 'Cancel' }))
    dialog = screen.getByRole('dialog', { name: 'Cancel this appointment?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(server.updateStatus).toHaveBeenCalledTimes(1)

    await userEvent.click(within(rowOf('Ahmed Hassan')).getByRole('button', { name: 'Cancel' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, cancel it' }))
    expect(server.updateStatus).toHaveBeenLastCalledWith(2, 'cancelled')
    expect(await within(rowOf('Ahmed Hassan')).findByText('Cancelled')).toBeInTheDocument()
  })

  it('shows the server message when a change is refused', async () => {
    const server = fakeServer([appt(1, '2026-10-05', '17:00', '17:45', MONA)])
    server.updateStatus.mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, { status: 422, data: { message: 'This status change is not allowed.' } }),
    )
    renderSchedule()

    await userEvent.click(await screen.findByRole('button', { name: 'Arrived' }))

    expect(await screen.findByText('This status change is not allowed.')).toBeInTheDocument()
  })

  it('moves between days and back to today', async () => {
    const server = fakeServer([appt(3, '2026-10-06', '17:00', '17:45', MONA)])
    renderSchedule()

    expect(await screen.findByText('No appointments on this day.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(await screen.findByText('Mona Ali')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tuesday · 6 Oct 2026' })).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/doctor/schedule')

    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(server.getSchedule).toHaveBeenLastCalledWith({ from: '2026-10-04', to: '2026-10-04' })
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(await screen.findByRole('heading', { name: 'Monday · 5 Oct 2026' })).toBeInTheDocument()
  })

  it('opens a day from ?date=', async () => {
    fakeServer([appt(3, '2026-10-06', '17:00', '17:45', MONA)])
    renderSchedule('/doctor/schedule?date=2026-10-06')

    expect(await screen.findByText('Mona Ali')).toBeInTheDocument()
  })

  it('books a slot for a patient', async () => {
    const server = fakeServer()
    renderSchedule()

    await userEvent.click(await screen.findByRole('button', { name: 'Book for patient' }))
    const dialog = screen.getByRole('dialog', { name: 'Book for patient' })
    expect(within(dialog).getByRole('button', { name: 'Book' })).toBeDisabled()

    await userEvent.type(within(dialog).getByLabelText('Patient'), 'ahm')
    await userEvent.click(await within(dialog).findByRole('button', { name: /Ahmed Hassan/ }))
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-05' } })
    await userEvent.click(await within(dialog).findByRole('button', { name: '18:30' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Book' }))

    expect(server.book).toHaveBeenCalledWith({ patient_id: 2, start_at: '2026-10-05T18:30:00+03:00' })
    expect(await screen.findByText('Appointment booked for Ahmed Hassan.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('Ahmed Hassan')).toBeInTheDocument()
  })

  it('refreshes the free times and keeps the dialog open when the slot was just taken (409)', async () => {
    const server = fakeServer()
    let taken = false
    const getSlots = slotsApi.getSlots.mockImplementation(async (date) => ({
      data: [
        ...(taken ? [] : [{ start_at: `${date}T18:30:00+03:00`, end_at: `${date}T19:15:00+03:00` }]),
        { start_at: `${date}T19:15:00+03:00`, end_at: `${date}T20:00:00+03:00` },
      ],
      meta: { date, duration: 45, booking_window_days: 30 },
    }))
    server.book.mockImplementation(async () => {
      taken = true // a patient booked 18:30 online a moment ago
      throw new AxiosError('Conflict', 'ERR', undefined, undefined, { status: 409, data: { message: 'Slot no longer available.' } })
    })
    renderSchedule()

    await userEvent.click(await screen.findByRole('button', { name: 'Book for patient' }))
    const dialog = screen.getByRole('dialog', { name: 'Book for patient' })
    await userEvent.type(within(dialog).getByLabelText('Patient'), 'mona')
    await userEvent.click(await within(dialog).findByRole('button', { name: /Mona Ali/ }))
    await userEvent.click(await within(dialog).findByRole('button', { name: '18:30' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Book' }))

    expect(await screen.findByText('That time was just taken. Please pick another one.')).toBeInTheDocument()
    await vi.waitFor(() => expect(within(dialog).queryByRole('button', { name: '18:30' })).not.toBeInTheDocument())
    expect(getSlots.mock.calls.filter(([d]) => d === '2026-10-05')).toHaveLength(2)
    expect(within(dialog).getByRole('button', { name: '19:15' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByRole('button', { name: 'Book' })).toBeDisabled()
    expect(screen.getByRole('dialog', { name: 'Book for patient' })).toBeInTheDocument()
  })
})

describe('Schedule: start visit (T5-09)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:05:00Z')) // 17:05 in Cairo
  })

  afterEach(() => vi.useRealTimers())

  it('Arrived → Start visit → Save → the badge turns green', async () => {
    const server = fakeServer([appt(1, '2026-10-05', '17:00', '17:45', MONA)])
    renderSchedule()

    await userEvent.click(await screen.findByRole('button', { name: 'Arrived' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Start visit' }))

    // The form gets the appointment from the link: no schedule lookup needed.
    expect(await screen.findByRole('heading', { name: 'New visit' })).toBeInTheDocument()
    expect(screen.getByText(/Appointment: 5 Oct 2026/)).toHaveTextContent('17:00 – 17:45')
    await userEvent.type(screen.getByLabelText('Work done today'), 'Filling')
    await userEvent.type(screen.getByLabelText('Total cost'), '400')
    await userEvent.type(screen.getByLabelText('Amount paid now'), '400')
    await userEvent.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(server.createVisit).toHaveBeenCalledWith(expect.objectContaining({ patient_id: 1, appointment_id: 1, total_amount: '400' }))
    await expectPath('/doctor/patients/1')

    await userEvent.click(screen.getAllByRole('link', { name: 'Schedule' })[0])
    const badge = await within(await screen.findByRole('list', { name: 'Appointments' })).findByText('Completed')
    expect(badge).toHaveAttribute('data-status', 'completed')
    expect(badge.className).toContain('bg-green-100')
    expect(screen.queryByRole('link', { name: 'Start visit' })).not.toBeInTheDocument()
  })
})

describe('Schedule: week view', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z')) // Monday 08:00 in Cairo
  })

  afterEach(() => vi.useRealTimers())

  it('marks today in words and as the current date, not by the ring colour alone', async () => {
    fakeServer([])
    renderSchedule()
    await userEvent.click(await screen.findByRole('button', { name: 'Week' }))

    const today = await screen.findByRole('region', { name: 'Monday 5 Oct 2026' })
    expect(today).toHaveAttribute('aria-current', 'date')
    expect(within(today).getByText('Today')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sunday 4 Oct 2026' })).not.toHaveAttribute('aria-current')
  })

  it('shows seven columns from Saturday with each day’s appointments', async () => {
    const server = fakeServer([
      appt(1, '2026-10-05', '17:00', '17:45', MONA),
      appt(2, '2026-10-07', '18:30', '19:15', AHMED, 'cancelled'),
      appt(3, '2026-10-07', '17:00', '17:45', MONA, 'checked_in'),
      appt(4, '2026-10-12', '17:00', '17:45', AHMED), // next week
    ])
    renderSchedule()

    await screen.findByRole('list', { name: 'Appointments' })
    await userEvent.click(screen.getByRole('button', { name: 'Week' }))

    expect(await screen.findByRole('heading', { name: '3 Oct 2026 – 9 Oct 2026' })).toBeInTheDocument()
    expect(server.getSchedule).toHaveBeenLastCalledWith({ from: '2026-10-03', to: '2026-10-09' })
    const columns = screen.getAllByRole('region')
    expect(columns.map((c) => c.getAttribute('aria-label'))).toEqual([
      'Saturday 3 Oct 2026',
      'Sunday 4 Oct 2026',
      'Monday 5 Oct 2026',
      'Tuesday 6 Oct 2026',
      'Wednesday 7 Oct 2026',
      'Thursday 8 Oct 2026',
      'Friday 9 Oct 2026',
    ])
    expect(columns[2]).toHaveTextContent('17:00 Mona Ali')
    expect(columns[2]).toHaveTextContent('1 appointment')
    expect(within(columns[4]).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('17:00 Mona Ali'),
      expect.stringContaining('18:30 Ahmed Hassan'),
    ])
    expect(columns[4]).toHaveTextContent('1 appointment') // the cancelled one is not counted
    expect(columns[0]).toHaveTextContent('No appointments')
    expect(screen.queryByText('Arrived')).not.toBeInTheDocument()
  })

  it('jumps into a day from the week', async () => {
    fakeServer([appt(3, '2026-10-07', '17:00', '17:45', MONA)])
    renderSchedule('/doctor/schedule?view=week')

    await userEvent.click(await screen.findByRole('button', { name: 'Open Wednesday 7 Oct 2026' }))

    expect(await screen.findByRole('heading', { name: 'Wednesday · 7 Oct 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(await screen.findByRole('list', { name: 'Appointments' })).getByRole('button', { name: 'Arrived' })).toBeInTheDocument()
  })

  it('moves a week at a time', async () => {
    const server = fakeServer([appt(4, '2026-10-12', '17:00', '17:45', AHMED)])
    renderSchedule('/doctor/schedule?view=week')

    await screen.findByRole('heading', { name: '3 Oct 2026 – 9 Oct 2026' })
    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))

    expect(await screen.findByRole('heading', { name: '10 Oct 2026 – 16 Oct 2026' })).toBeInTheDocument()
    expect(server.getSchedule).toHaveBeenLastCalledWith({ from: '2026-10-10', to: '2026-10-16' })
    expect(await screen.findByText('Ahmed Hassan')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'This week' }))
    expect(await screen.findByRole('heading', { name: '3 Oct 2026 – 9 Oct 2026' })).toBeInTheDocument()
  })
})

describe('Schedule: auto-refresh', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => vi.useRealTimers())

  it('refetches the day every 60 seconds', async () => {
    // Only the interval is faked; React and the first load use real timers.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z'))
    const server = fakeServer([appt(1, '2026-10-05', '17:00', '17:45', MONA)])
    renderSchedule()

    await screen.findByText('Mona Ali')
    expect(server.getSchedule).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(59_000)
    expect(server.getSchedule).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.waitFor(() => expect(server.getSchedule).toHaveBeenCalledTimes(2))
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
    fakeServer([appt(2, '2026-10-05', '18:30', '19:15', AHMED, 'checked_in'), appt(1, '2026-10-05', '17:00', '17:45', MONA)])
    await expectNoA11yViolationsInBothLanguages(() => renderSchedule())
  })
})
