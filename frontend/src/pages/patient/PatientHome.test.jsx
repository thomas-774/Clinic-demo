import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as patientApi from '../../api/patient'
import { renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const profile = {
  id: 1,
  name: 'Mona Ali',
  phone: '01012345678',
  email: null,
  address: '12 Tahrir St',
  date_of_birth: null,
  gender: 'female',
  current_illness: 'Toothache',
  simple_history: [
    { id: 2, recorded_on: '2026-03-01', title: 'Asthma', description: 'Uses an inhaler.' },
    { id: 1, recorded_on: '2024-01-15', title: 'Appendectomy', description: null },
  ],
  next_appointment: null,
  outstanding_balance: '0.00',
  unpaid_visits: [],
}

function renderHome() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 5, name: 'Mona Ali', role: 'patient', patient_id: 1 })
  return renderAppAt('/patient')
}

describe('PatientHome', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows personal info, illness and the simple history', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    renderHome()

    expect(await screen.findByRole('heading', { name: 'Hello, Mona Ali' })).toBeInTheDocument()
    expect(screen.getByText('01012345678')).toBeInTheDocument()
    expect(screen.getByText('12 Tahrir St')).toBeInTheDocument()
    expect(screen.getByText('Toothache')).toBeInTheDocument()
    expect(screen.getByText('Asthma')).toBeInTheDocument()
    expect(screen.getByText('Uses an inhaler.')).toBeInTheDocument()
    expect(screen.getByText('1 Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('You have no upcoming appointment.')).toBeInTheDocument()
    expect(screen.getByText('EGP 0.00')).toBeInTheDocument()
  })

  it('shows the next appointment with date, time and status', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue({
      ...profile,
      next_appointment: {
        id: 9,
        start_at: '2026-10-06T18:30:00+03:00',
        end_at: '2026-10-06T19:15:00+03:00',
        status: 'booked',
        can_cancel: true,
      },
    })
    renderHome()

    const card = (await screen.findByRole('heading', { name: 'Next appointment' })).closest('section')
    expect(card).toHaveTextContent('6 Oct 2026')
    expect(card).toHaveTextContent('18:30 – 19:15')
    expect(within(card).getByText('Booked')).toHaveAttribute('data-status', 'booked')
    expect(within(card).getByRole('link', { name: 'View or cancel' })).toHaveAttribute('href', '/patient/appointments')
    expect(within(card).queryByRole('link', { name: 'Book an appointment' })).not.toBeInTheDocument()
  })

  it('offers "Book now" when there is no upcoming appointment', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    renderHome()

    const card = (await screen.findByRole('heading', { name: 'Next appointment' })).closest('section')
    expect(within(card).getByRole('link', { name: 'Book an appointment' })).toHaveAttribute('href', '/patient/book')
  })

  it('shows the outstanding balance in red with the visits still owed', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue({
      ...profile,
      outstanding_balance: '800.50',
      unpaid_visits: [
        { id: 9, visit_date: '2026-10-05', remaining: '500.00' },
        { id: 4, visit_date: '2026-08-10', remaining: '300.50' },
      ],
    })
    renderHome()

    const card = (await screen.findByRole('heading', { name: 'Remaining balance' })).closest('section')
    const total = within(card).getByText('EGP 800.50')
    expect(total.className).toContain('text-red-600')
    const rows = within(within(card).getByRole('list', { name: 'Visits with a balance' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Visit of 5 Oct 2026')
    expect(rows[0]).toHaveTextContent('EGP 500.00')
    expect(rows[1]).toHaveTextContent('Visit of 10 Aug 2026')
    expect(rows[1]).toHaveTextContent('EGP 300.50')
    expect(within(card).queryByText('No balance due.')).not.toBeInTheDocument()
  })

  it('says "No balance due" when nothing is owed', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    renderHome()

    const card = (await screen.findByRole('heading', { name: 'Remaining balance' })).closest('section')
    expect(within(card).getByText('No balance due.')).toBeInTheDocument()
    expect(within(card).getByText('EGP 0.00').className).not.toContain('text-red-600')
    expect(within(card).queryByRole('list')).not.toBeInTheDocument()
  })

  it('updates phone and address', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    const update = vi
      .spyOn(patientApi, 'updateProfile')
      .mockResolvedValue({ ...profile, phone: '01099998888', address: 'New street' })
    renderHome()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit contact info' }))
    const phone = screen.getByLabelText('Phone')
    // Phone keypad and autofill on a phone (NFR-U.2).
    expect(phone).toHaveAttribute('type', 'tel')
    expect(phone).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByLabelText('Address')).toHaveAttribute('autocomplete', 'street-address')
    await userEvent.clear(phone)
    await userEvent.type(phone, '01099998888')
    const address = screen.getByLabelText('Address')
    await userEvent.clear(address)
    await userEvent.type(address, 'New street')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Contact info saved.')).toBeInTheDocument()
    expect(update.mock.calls[0][0]).toEqual({ phone: '01099998888', address: 'New street' })
    expect(screen.getByText('01099998888')).toBeInTheDocument()
    expect(screen.getByText('New street')).toBeInTheDocument()
  })

  it('offers no way to edit the name or the illness', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    renderHome()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit contact info' }))

    const form = screen.getByRole('button', { name: 'Save' }).closest('form')
    expect(within(form).getAllByRole('textbox').map((input) => input.value)).toEqual(['01012345678', '12 Tahrir St'])
  })

  it('shows a taken phone number under the field', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    vi.spyOn(patientApi, 'updateProfile').mockRejectedValue(
      new AxiosError('x', '422', {}, null, {
        status: 422,
        data: { errors: { phone: ['The phone has already been taken.'] } },
      }),
    )
    renderHome()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit contact info' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('The phone has already been taken.')).toBeInTheDocument()
  })

  it('cancelling does not claim anything was saved', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    renderHome()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit contact info' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Contact info saved.')).not.toBeInTheDocument()
  })

  it('shows an error with retry when the profile cannot load', async () => {
    vi.spyOn(patientApi, 'getProfile').mockRejectedValue(new Error('down'))
    renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong while loading.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue(profile)
    await expectNoA11yViolationsInBothLanguages(renderHome)
  })
})
