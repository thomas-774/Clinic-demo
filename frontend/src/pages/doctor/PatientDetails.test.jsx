import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as api from '../../api/doctorPatients'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

function makePatient(history) {
  return {
    id: 7,
    name: 'Mona Ali',
    phone: '01012345678',
    email: null,
    address: '12 Tahrir St',
    date_of_birth: '1990-05-01',
    gender: 'female',
    current_illness: 'Toothache',
    visits: [],
    history,
  }
}

const ASTHMA = { id: 1, type: 'condition', title: 'Asthma', details: 'Inhaler', patient_visible: true, recorded_on: '2025-01-01' }
const NOTE = { id: 2, type: 'note', title: 'Anxious patient', details: 'Very anxious about needles', patient_visible: false, recorded_on: '2026-01-01' }

/** A tiny in-memory API so saves show up on refetch. */
function fakeServer(initial = [NOTE, ASTHMA]) {
  let history = [...initial]
  let nextId = 10
  vi.spyOn(api, 'getPatient').mockImplementation(async () => makePatient(history))
  return {
    add: vi.spyOn(api, 'addHistoryEntry').mockImplementation(async (_pid, fields) => {
      const entry = { id: nextId++, ...fields }
      history = [entry, ...history]
      return entry
    }),
    update: vi.spyOn(api, 'updateHistoryEntry').mockImplementation(async (_pid, id, fields) => {
      history = history.map((e) => (e.id === id ? { ...e, ...fields } : e))
      return history.find((e) => e.id === id)
    }),
    remove: vi.spyOn(api, 'deleteHistoryEntry').mockImplementation(async (_pid, id) => {
      history = history.filter((e) => e.id !== id)
      return { data: null }
    }),
  }
}

function renderDetails() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/patients/7')
}

describe('PatientDetails', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows info, illness and every history entry with a private badge', async () => {
    fakeServer()
    renderDetails()

    expect(await screen.findByText('Mona Ali')).toBeInTheDocument()
    expect(screen.getByText('Toothache')).toBeInTheDocument()
    expect(screen.getByText('Female')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Anxious patient')).toBeInTheDocument()
    expect(within(items[0]).getByText('Private')).toBeInTheDocument()
    expect(within(items[1]).queryByText('Private')).not.toBeInTheDocument()
    expect(screen.getByText('No visits yet.')).toBeInTheDocument()
  })

  it('says so for a new patient with no illness, history or visits yet (T7-03)', async () => {
    fakeServer([])
    api.getPatient.mockImplementation(async () => ({ ...makePatient([]), current_illness: null }))
    renderDetails()

    expect(await screen.findByText('No history recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('No visits yet.')).toBeInTheDocument()
    expect(screen.getByText('Nothing recorded.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('adds a private entry by default', async () => {
    const server = fakeServer([])
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Add entry' }))
    const dialog = screen.getByRole('dialog', { name: 'Add history entry' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'allergy')
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Penicillin')
    expect(within(dialog).getByLabelText('Visible to the patient')).not.toBeChecked()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(server.add.mock.calls[0][1]).toMatchObject({ type: 'allergy', title: 'Penicillin', patient_visible: false, details: null })
    expect(await screen.findByText('Penicillin')).toBeInTheDocument()
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('edits an entry and makes it visible', async () => {
    const server = fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Anxious patient' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit history entry' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('Anxious patient')
    await userEvent.click(within(dialog).getByLabelText('Visible to the patient'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(server.update).toHaveBeenCalledWith(7, 2, expect.objectContaining({ patient_visible: true })))
    await waitFor(() => expect(screen.queryByText('Private')).not.toBeInTheDocument())
  })

  it('deletes an entry after confirmation', async () => {
    const server = fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Asthma' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete history entry?' })
    expect(dialog).toHaveTextContent('“Asthma” will be removed permanently.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('Asthma')).not.toBeInTheDocument())
    expect(server.remove).toHaveBeenCalledWith(7, 1)
  })

  it('does not delete when the confirmation is cancelled', async () => {
    const server = fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Asthma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(server.remove).not.toHaveBeenCalled()
    expect(screen.getByText('Asthma')).toBeInTheDocument()
  })

  it('filters the history by type', async () => {
    fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Condition' }))

    expect(screen.getByText('Asthma')).toBeInTheDocument()
    expect(screen.queryByText('Anxious patient')).not.toBeInTheDocument()
  })

  it('edits the patient info and illness', async () => {
    fakeServer()
    const update = vi.spyOn(api, 'updatePatient').mockImplementation(async (_id, fields) => ({ ...makePatient([]), ...fields }))
    renderDetails()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit patient' })
    const illness = within(dialog).getByLabelText('Current illness')
    await userEvent.clear(illness)
    await userEvent.type(illness, 'Root canal needed')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(update.mock.calls[0]).toEqual([
      7,
      expect.objectContaining({ name: 'Mona Ali', current_illness: 'Root canal needed', gender: 'female', date_of_birth: '1990-05-01' }),
    ])
  })

  it('opens a walk-in visit form for this patient', async () => {
    fakeServer()
    renderDetails()

    await userEvent.click(await screen.findByRole('link', { name: 'New walk-in visit' }))

    await expectPath('/doctor/visits/new')
    expect(await screen.findByText('Walk-in visit')).toBeInTheDocument()
  })

  it('links to the activity on this patient (NFR-S.5)', async () => {
    fakeServer()
    renderDetails()

    expect(await screen.findByRole('link', { name: 'Activity on this patient' })).toHaveAttribute('href', '/doctor/settings?tab=activity&patient=7')
  })

  it('says so when the patient does not exist', async () => {
    vi.spyOn(api, 'getPatient').mockRejectedValue(new AxiosError('x', '404', {}, null, { status: 404, data: {} }))
    renderDetails()

    expect(await screen.findByText('This patient does not exist.')).toBeInTheDocument()
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
    await expectNoA11yViolationsInBothLanguages(renderDetails)
  })
})
