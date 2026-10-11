import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as appointmentsApi from '../../api/appointments'
import * as assistantApi from '../../api/assistant'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as visitsApi from '../../api/visits'
import { renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const MONA = { id: 1, name: 'Mona Ali', phone: '01011112222' }
const AHMED = { id: 2, name: 'Ahmed Hassan', phone: '01233334444' }

const appt = (id, time, patient, status = 'booked') => ({
  id,
  start_at: `2026-10-05T${time}:00+03:00`,
  end_at: `2026-10-05T${time.replace(':00', ':45')}:00+03:00`,
  status,
  checked_in_at: null,
  cancelled_at: null,
  patient,
})

const visit = (id, patient, total, paid) => ({
  id,
  patient_id: patient.id,
  visit_date: '2026-10-05',
  total_amount: total,
  paid,
  remaining: (Number(total) - Number(paid)).toFixed(2),
  payment_status: Number(paid) === 0 ? 'unpaid' : 'partially_paid',
  patient,
})

function renderToday() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 3, name: 'Amal Saad', role: 'assistant' })
  return renderAppAt('/assistant')
}

const waiting = () => screen.getByRole('list', { name: 'Visits waiting for payment' })

describe('Assistant: Today', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z')) // Monday 17:20 in Cairo
  })

  afterEach(() => vi.useRealTimers())

  it("shows today's queue from the assistant API, without Start visit", async () => {
    const schedule = vi.spyOn(assistantApi, 'getSchedule').mockResolvedValue([
      appt(1, '17:00', MONA, 'checked_in'),
      appt(2, '18:00', AHMED),
    ])
    const doctorSchedule = vi.spyOn(appointmentsApi, 'getSchedule')
    vi.spyOn(assistantApi, 'getUnpaidVisits').mockResolvedValue([])

    renderToday()

    expect(await screen.findByRole('heading', { name: 'Today at the desk' })).toBeInTheDocument()
    const rows = within(await screen.findByRole('list', { name: 'Appointments' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(schedule).toHaveBeenCalledWith({ from: '2026-10-05', to: '2026-10-05' })
    expect(doctorSchedule).not.toHaveBeenCalled()
    expect(within(rows[0]).queryByRole('link', { name: 'Start visit' })).not.toBeInTheDocument()
    expect(within(rows[0]).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: 'Arrived' })).toBeInTheDocument()
    expect(await screen.findByText('Nobody is waiting to pay.')).toBeInTheDocument()
  })

  it('marks a patient Arrived through the assistant API', async () => {
    const user = userEvent.setup()
    vi.spyOn(assistantApi, 'getSchedule').mockResolvedValue([appt(2, '18:00', AHMED)])
    vi.spyOn(assistantApi, 'getUnpaidVisits').mockResolvedValue([])
    const update = vi.spyOn(assistantApi, 'updateAppointmentStatus').mockResolvedValue({ ...appt(2, '18:00', AHMED, 'checked_in') })
    const doctorUpdate = vi.spyOn(appointmentsApi, 'updateAppointmentStatus')

    renderToday()
    await user.click(await within(await screen.findByRole('list', { name: 'Appointments' })).findByRole('button', { name: 'Arrived' }))

    expect(update).toHaveBeenCalledWith(2, 'checked_in')
    expect(doctorUpdate).not.toHaveBeenCalled()
    expect(await screen.findByText('Ahmed Hassan checked in.')).toBeInTheDocument()
  })

  it('lists the visits waiting to pay and records a payment', async () => {
    const user = userEvent.setup()
    vi.spyOn(assistantApi, 'getSchedule').mockResolvedValue([])
    let unpaid = [visit(10, MONA, '1500.00', '0.00'), visit(11, AHMED, '800.00', '500.00')]
    const getUnpaid = vi.spyOn(assistantApi, 'getUnpaidVisits').mockImplementation(async () => unpaid)
    const pay = vi.spyOn(assistantApi, 'addPayment').mockImplementation(async () => {
      unpaid = [visit(10, MONA, '1500.00', '1000.00'), unpaid[1]]
      return unpaid[0]
    })
    const doctorPay = vi.spyOn(visitsApi, 'addPayment')

    renderToday()

    await screen.findByRole('list', { name: 'Visits waiting for payment' })
    const [mona, ahmed] = within(waiting()).getAllByRole('listitem')
    expect(within(mona).getByRole('link', { name: 'Mona Ali' })).toHaveAttribute('href', '/assistant/patients/1')
    expect(mona).toHaveTextContent(/EGP\s1,500\.00/)
    expect(within(mona).getByText('Unpaid')).toBeInTheDocument()
    expect(ahmed).toHaveTextContent(/EGP\s300\.00/)
    expect(within(ahmed).getByText('Partially paid')).toBeInTheDocument()

    await user.click(within(mona).getByRole('button', { name: 'Record payment' }))
    const dialog = await screen.findByRole('dialog', { name: 'Payment from Mona Ali' })
    const amount = within(dialog).getByLabelText(/Amount/)
    expect(amount).toHaveValue('1500.00')
    await user.clear(amount)
    await user.type(amount, '1000')
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }))

    expect(pay).toHaveBeenCalledWith(10, { amount: '1000', method: 'cash' })
    expect(doctorPay).not.toHaveBeenCalled()
    expect(await screen.findByText(/Payment recorded\. Remaining: EGP\s500\.00/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The list is fetched again: Mona now owes 500.
    await vi.waitFor(() => expect(within(waiting()).getAllByRole('listitem')[0]).toHaveTextContent(/Paid EGP\s1,000\.00/))
    expect(within(waiting()).getAllByRole('listitem')[0]).toHaveTextContent(/RemainingEGP\s500\.00/)
    expect(getUnpaid.mock.calls.length).toBeGreaterThan(1)
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    vi.spyOn(assistantApi, 'getSchedule').mockResolvedValue([appt(1, '17:00', MONA, 'checked_in'), appt(2, '18:00', AHMED)])
    vi.spyOn(assistantApi, 'getUnpaidVisits').mockResolvedValue([])
    await expectNoA11yViolationsInBothLanguages(renderToday)
  })
})
