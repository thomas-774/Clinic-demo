import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as api from '../../api/doctorPatients'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const PATIENTS = [
  { id: 1, name: 'Ahmed Hassan', phone: '01233334444', last_visit_date: null },
  { id: 2, name: 'Mona Ali', phone: '01011112222', last_visit_date: '2026-09-20' },
  { id: 3, name: 'Monir Saad', phone: '01555556666', last_visit_date: null },
]

function page(rows, { current = 1, last = 1 } = {}) {
  return { data: rows, meta: { current_page: current, last_page: last, total: rows.length }, message: null }
}

function fakeList() {
  return vi.spyOn(api, 'listPatients').mockImplementation(async ({ search = '', page: p = 1 }) => {
    const rows = PATIENTS.filter((row) => !search || row.name.toLowerCase().includes(search.toLowerCase()) || row.phone.includes(search))
    return page(rows, { current: p, last: 2 })
  })
}

function renderAsDoctor(path = '/doctor/patients') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt(path)
}

describe('PatientsList', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists patients with phone and last visit', async () => {
    fakeList()
    renderAsDoctor()

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(within(table).getByText('Mona Ali')).toBeInTheDocument()
    expect(within(table).getByText('20 Sept 2026')).toBeInTheDocument()
  })

  it('searches after typing stops and keeps the search in the URL', async () => {
    const list = fakeList()
    renderAsDoctor()
    await screen.findByRole('table')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search patients' }), 'mon')

    await waitFor(() => expect(screen.queryByText('Ahmed Hassan')).not.toBeInTheDocument())
    expect(screen.getByText('Mona Ali')).toBeInTheDocument()
    expect(screen.getByText('Monir Saad')).toBeInTheDocument()
    // Debounced: one request for "mon", none for "m" or "mo".
    expect(list.mock.calls.map(([args]) => args.search)).toEqual(['', 'mon'])
  })

  it('reads the search from the URL', async () => {
    fakeList()
    renderAsDoctor('/doctor/patients?search=3333')

    expect(await screen.findByText('Ahmed Hassan')).toBeInTheDocument()
    expect(screen.queryByText('Mona Ali')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox')).toHaveValue('3333')
  })

  it('opens a patient when the row is clicked', async () => {
    fakeList()
    vi.spyOn(api, 'getPatient').mockReturnValue(new Promise(() => {}))
    renderAsDoctor()

    await userEvent.click(await screen.findByText('01011112222'))

    await expectPath('/doctor/patients/2')
  })

  it('shows an empty message when nothing matches', async () => {
    fakeList()
    renderAsDoctor('/doctor/patients?search=zzz')

    expect(await screen.findByText('No patients match “zzz”.')).toBeInTheDocument()
  })

  it('moves to the next page', async () => {
    const list = fakeList()
    renderAsDoctor()

    await userEvent.click(await screen.findByRole('button', { name: 'Next' }))

    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: '', page: 2 }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('creates a patient and shows the initial password once', async () => {
    const list = fakeList()
    const create = vi.spyOn(api, 'createPatient').mockResolvedValue({
      id: 9, name: 'Phone Patient', phone: '01044445555', initial_password: 'k7m2p9qa',
    })
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAsDoctor()
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    const dialog = screen.getByRole('dialog', { name: 'New patient' })
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Phone Patient')
    await userEvent.type(within(dialog).getByLabelText('Phone'), '01044445555')
    await userEvent.type(within(dialog).getByLabelText('Address'), 'Giza')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create patient' }))

    expect(await screen.findByTestId('initial-password')).toHaveTextContent('k7m2p9qa')
    expect(create.mock.calls[0][0]).toMatchObject({ name: 'Phone Patient', phone: '01044445555', address: 'Giza', email: null, gender: null })
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith('k7m2p9qa')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(list.mock.calls.length).toBeGreaterThan(1) // list refreshed

    // Opening the form again starts clean; the password is gone.
    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    expect(screen.queryByText('k7m2p9qa')).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByLabelText('Full name')).toHaveValue('')
  })

  it('shows validation errors in the new patient form', async () => {
    fakeList()
    vi.spyOn(api, 'createPatient').mockRejectedValue(
      new AxiosError('x', '422', {}, null, { status: 422, data: { errors: { phone: ['The phone has already been taken.'] } } }),
    )
    renderAsDoctor()
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    await userEvent.click(screen.getByRole('button', { name: 'Create patient' }))

    expect(await screen.findByText('The phone has already been taken.')).toBeInTheDocument()
  })

  it('closes the form with Escape', async () => {
    fakeList()
    renderAsDoctor()
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'New patient' }))
    expect(screen.getByLabelText('Full name')).toHaveFocus()
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    fakeList()
    await expectNoA11yViolationsInBothLanguages(() => renderAsDoctor())
  })
})
