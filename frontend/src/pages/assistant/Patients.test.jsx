import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as assistantApi from '../../api/assistant'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as doctorPatientsApi from '../../api/doctorPatients'
import * as slotsApi from '../../api/slots'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const LIST = {
  data: [{ id: 2, name: 'Mona Ali', phone: '01011112222', last_visit_date: '2026-10-05' }],
  meta: { current_page: 1, last_page: 1, total: 1 },
}

const PATIENT = {
  id: 2,
  user_id: 9,
  name: 'Mona Ali',
  phone: '01011112222',
  email: null,
  address: '12 Tahrir St',
  date_of_birth: null,
  gender: 'female',
  next_appointment: null,
  outstanding_balance: '500.00',
  visits: [
    {
      id: 10,
      patient_id: 2,
      visit_date: '2026-10-05',
      total_amount: '1500.00',
      paid: '1000.00',
      remaining: '500.00',
      payment_status: 'partially_paid',
      payments: [{ id: 1, amount: '1000.00', method: 'cash', paid_at: '2026-10-05T18:00:00+03:00', recorded_by_name: 'Amal Saad' }],
    },
  ],
}

function renderAsAssistant(path) {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 3, name: 'Amal Saad', role: 'assistant' })
  return renderAppAt(path)
}

describe('Assistant: patients', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists patients from the assistant API and opens the assistant patient page', async () => {
    const list = vi.spyOn(assistantApi, 'listPatients').mockResolvedValue(LIST)
    const doctorList = vi.spyOn(doctorPatientsApi, 'listPatients')
    vi.spyOn(assistantApi, 'getPatient').mockResolvedValue(PATIENT)

    renderAsAssistant('/assistant/patients')

    const link = await screen.findByRole('link', { name: 'Mona Ali' })
    expect(link).toHaveAttribute('href', '/assistant/patients/2')
    expect(list).toHaveBeenCalledWith({ search: '', page: 1 })
    expect(doctorList).not.toHaveBeenCalled()

    await userEvent.click(link)
    await expectPath('/assistant/patients/2')
    expect(await screen.findByTestId('outstanding')).toHaveTextContent(/EGP\s500\.00/)
  })

  it('registers a new patient without a current illness field', async () => {
    vi.spyOn(assistantApi, 'listPatients').mockResolvedValue(LIST)
    const create = vi.spyOn(assistantApi, 'createPatient').mockResolvedValue({ ...PATIENT, id: 5, name: 'Sara Adel', phone: '01555556666', initial_password: 'abcd2345' })

    renderAsAssistant('/assistant/patients')
    await userEvent.click(await screen.findByRole('button', { name: 'New patient' }))
    const dialog = await screen.findByRole('dialog', { name: 'New patient' })

    expect(within(dialog).queryByLabelText(/Current illness/)).not.toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Sara Adel')
    await userEvent.type(within(dialog).getByLabelText(/Phone/), '01555556666')
    await userEvent.type(within(dialog).getByLabelText(/Address/), '5 Nile St')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toMatchObject({ name: 'Sara Adel', phone: '01555556666', address: '5 Nile St' })
    expect(create.mock.calls[0][0]).not.toHaveProperty('current_illness')
    expect(await screen.findByTestId('initial-password')).toHaveTextContent('abcd2345')
  })

  it('shows contact info and money, but no illness, history or work done', async () => {
    vi.spyOn(assistantApi, 'getPatient').mockResolvedValue(PATIENT)

    renderAsAssistant('/assistant/patients/2')

    expect(await screen.findByRole('heading', { name: 'Mona Ali' })).toBeInTheDocument()
    expect(screen.getByText('12 Tahrir St')).toBeInTheDocument()
    expect(screen.getByText('No upcoming appointment.')).toBeInTheDocument()
    expect(screen.queryByText('Current illness')).not.toBeInTheDocument()
    expect(screen.queryByText('Medical history')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeInTheDocument() // contact info only
    const visit = screen.getByRole('listitem', { name: '5 Oct 2026' })
    expect(within(visit).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    // The visit file holds the work done: doctor only (FR-K.6).
    expect(within(visit).queryByRole('button', { name: /Download visit/ })).not.toBeInTheDocument()
    expect(within(visit).queryByRole('button', { name: /^(PDF|Word)$/ })).not.toBeInTheDocument()

    await userEvent.click(within(visit).getByRole('button', { name: /Show payment/ }))
    expect(within(visit).getByText(/by Amal Saad/)).toBeInTheDocument()
  })

  it('edits contact info without the illness', async () => {
    vi.spyOn(assistantApi, 'getPatient').mockResolvedValue(PATIENT)
    const update = vi.spyOn(assistantApi, 'updatePatient').mockResolvedValue({ ...PATIENT, address: 'New address' })

    renderAsAssistant('/assistant/patients/2')
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit patient' })
    expect(within(dialog).queryByLabelText(/Current illness/)).not.toBeInTheDocument()

    const address = within(dialog).getByLabelText(/Address/)
    await userEvent.clear(address)
    await userEvent.type(address, 'New address')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith(2, expect.objectContaining({ address: 'New address' }))
    expect(update.mock.calls[0][1]).not.toHaveProperty('current_illness')
  })

  it('records an installment from the patient page', async () => {
    vi.spyOn(assistantApi, 'getPatient').mockResolvedValue(PATIENT)
    const pay = vi.spyOn(assistantApi, 'addPayment').mockResolvedValue({ ...PATIENT.visits[0], paid: '1500.00', remaining: '0.00', payment_status: 'paid' })

    renderAsAssistant('/assistant/patients/2')
    await userEvent.click(await screen.findByRole('button', { name: 'Add payment' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/Amount/)).toHaveValue('500.00')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save payment' }))

    expect(pay).toHaveBeenCalledWith(10, { amount: '500.00', method: 'cash' })
  })

  it('books an appointment for this patient through the assistant API', async () => {
    vi.spyOn(assistantApi, 'getPatient').mockResolvedValue(PATIENT)
    vi.spyOn(slotsApi, 'getSlots').mockResolvedValue({
      data: [{ start_at: '2099-01-01T17:00:00+02:00', end_at: '2099-01-01T17:45:00+02:00' }],
    })
    const book = vi.spyOn(assistantApi, 'bookForPatient').mockResolvedValue({ id: 99 })

    renderAsAssistant('/assistant/patients/2')
    await userEvent.click(await screen.findByRole('button', { name: 'Book appointment' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Mona Ali')).toBeInTheDocument()
    await userEvent.click(await within(dialog).findByRole('button', { name: /17:00/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Book' }))

    expect(book).toHaveBeenCalledWith({ patient_id: 2, start_at: '2099-01-01T17:00:00+02:00' })
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('list: has no serious or critical axe issues, in Arabic and in English', async () => {
    vi.spyOn(assistantApi, 'listPatients').mockResolvedValue(LIST)
    await expectNoA11yViolationsInBothLanguages(() => renderAsAssistant('/assistant/patients'))
  })

  it('patient page: has no serious or critical axe issues, in Arabic and in English', async () => {
    vi.spyOn(assistantApi, 'getPatient').mockResolvedValue(PATIENT)
    await expectNoA11yViolationsInBothLanguages(() => renderAsAssistant(`/assistant/patients/${PATIENT.id}`))
  })
})
