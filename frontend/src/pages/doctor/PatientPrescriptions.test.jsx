import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as patientsApi from '../../api/doctorPatients'
import * as prescriptionsApi from '../../api/prescriptions'
import { expectPath, renderAppAt } from '../../test/renderApp'

const visit = (id, date) => ({
  id,
  patient_id: 7,
  appointment_id: null,
  visit_date: date,
  work_done: 'Filling',
  total_amount: '500.00',
  paid: '500.00',
  remaining: '0.00',
  payment_status: 'paid',
  payments: [],
})

const LIST = [
  { id: 31, issued_on: '2026-10-04', visit_id: 90, notes: null, drug_names: ['Flagyl 500 mg', 'Panadol Extra'] },
  { id: 30, issued_on: '2026-09-01', visit_id: null, notes: null, drug_names: ['Augmentin 1 g'] },
]

function patient(prescriptions) {
  return {
    id: 7,
    name: 'Mona Ali',
    phone: '01011112222',
    email: null,
    address: 'Cairo',
    date_of_birth: null,
    gender: null,
    current_illness: null,
    history: [],
    visits: [visit(90, '2026-10-04'), visit(80, '2026-09-20')],
    outstanding_balance: '0.00',
    prescriptions_count: prescriptions.length,
  }
}

/** In-memory prescriptions so a delete shows up on refetch. */
function fakeServer(initial = LIST) {
  let prescriptions = [...initial]
  vi.spyOn(patientsApi, 'getPatient').mockImplementation(async () => patient(prescriptions))
  const list = vi.spyOn(prescriptionsApi, 'listPrescriptions').mockImplementation(async () => prescriptions)
  const remove = vi.spyOn(prescriptionsApi, 'deletePrescription').mockImplementation(async (id) => {
    prescriptions = prescriptions.filter((p) => p.id !== id)
    return { data: null }
  })
  return { list, remove }
}

function renderDetails() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/patients/7')
}

const card = () => screen.getByRole('heading', { name: 'Prescriptions' }).closest('section')
const visitItem = (date) => within(screen.getByRole('list', { name: 'Visits' })).getByRole('listitem', { name: date })

describe('PatientDetails: prescriptions', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists the prescriptions with date, drug names and the linked visit', async () => {
    const { list } = fakeServer()
    renderDetails()

    const rows = await within(await screen.findByRole('list', { name: 'Prescriptions' })).findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('4 Oct 2026')
    expect(rows[0]).toHaveTextContent('Visit of 4 Oct 2026')
    expect(rows[0]).toHaveTextContent('Flagyl 500 mg · Panadol Extra')
    expect(rows[1]).toHaveTextContent('1 Sept 2026')
    expect(rows[1]).not.toHaveTextContent('Visit of')
    expect(list).toHaveBeenCalledWith(7)

    expect(within(card()).getByRole('link', { name: 'Write prescription' })).toHaveAttribute('href', '/doctor/patients/7/prescriptions/new')
    expect(screen.getByRole('link', { name: 'Open / Edit the prescription of 4 Oct 2026' })).toHaveAttribute('href', '/doctor/prescriptions/31/edit')
  })

  it('Reprint opens the print route', async () => {
    fakeServer()
    vi.spyOn(prescriptionsApi, 'getPrescription').mockResolvedValue({
      id: 31,
      patient_id: 7,
      issued_on: '2026-10-04',
      notes: null,
      items: [{ id: 1, drug_name: 'Flagyl 500 mg', drug_form: 'tablets', instructions: 'Every 8 hours' }],
      patient: { id: 7, name: 'Mona Ali', age: null },
      print: { doctor_name: 'Dr. Doctor', paper: 'A5' },
    })
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderDetails()

    await userEvent.click(await screen.findByRole('link', { name: 'Reprint the prescription of 4 Oct 2026' }))

    await expectPath('/doctor/prescriptions/31/print')
    expect(await screen.findByRole('article', { name: 'Prescription' })).toHaveTextContent('Flagyl 500 mg')
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it('deletes a prescription after confirmation', async () => {
    const { remove } = fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete the prescription of 1 Sept 2026' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete prescription?' })
    expect(dialog).toHaveTextContent('The prescription of 1 Sept 2026 will be removed permanently.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(remove).toHaveBeenCalledWith(30)
    expect(await screen.findByText('Prescription deleted.')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Prescriptions' })).getAllByRole('listitem')).toHaveLength(1))
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const { remove } = fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete the prescription of 1 Sept 2026' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it('shows the empty state without asking for the list', async () => {
    const { list } = fakeServer([])
    renderDetails()

    expect(await screen.findByText('No prescriptions yet.')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })

  it('shows a retry box when the list fails to load', async () => {
    const { list } = fakeServer()
    list.mockRejectedValueOnce(new AxiosError('x', 'ERR', undefined, undefined, { status: 500, data: {} }))
    renderDetails()

    await userEvent.click(await within(await screen.findByRole('alert')).findByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('list', { name: 'Prescriptions' })).toBeInTheDocument()
  })

  it('each visit links to a prescription for it, and visits with prescriptions get a badge', async () => {
    fakeServer()
    renderDetails()

    await screen.findByRole('list', { name: 'Prescriptions' })
    expect(within(visitItem('4 Oct 2026')).getByRole('link', { name: 'Write prescription for the visit of 4 Oct 2026' })).toHaveAttribute(
      'href',
      '/doctor/patients/7/prescriptions/new?visit=90',
    )
    expect(within(visitItem('20 Sept 2026')).getByRole('link', { name: 'Write prescription for the visit of 20 Sept 2026' })).toHaveAttribute(
      'href',
      '/doctor/patients/7/prescriptions/new?visit=80',
    )
    expect(await within(visitItem('4 Oct 2026')).findByText('Prescriptions: 1')).toBeInTheDocument()
    expect(within(visitItem('20 Sept 2026')).queryByText(/Prescriptions:/)).not.toBeInTheDocument()
  })
})
