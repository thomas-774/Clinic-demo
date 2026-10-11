import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as patientsApi from '../../api/doctorPatients'
import * as drugsApi from '../../api/drugs'
import * as prescriptionsApi from '../../api/prescriptions'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const AUGMENTIN = { id: 11, trade_name: 'Augmentin 1 g', form: 'tablets', pack: '14 tabs', category: 'antibiotic', short_use: 'مضاد حيوي' }
const FLAGYL = { id: 21, trade_name: 'Flagyl 500 mg', form: 'tablets', pack: '20 tabs', category: 'antibiotic', short_use: 'مضاد للميكروبات اللاهوائية' }

const FULL = {
  11: { ...AUGMENTIN, active_ingredients: [{ name: 'amoxicillin', note: null }], uses: 'Augmentin uses', warnings: null, suggested_dose: 'قرص كل 12 ساعة' },
  21: {
    ...FLAGYL,
    active_ingredients: [{ name: 'metronidazole', note: null }],
    uses: 'Flagyl uses',
    warnings: 'No alcohol',
    suggested_dose: '1 tablet every 8 hours for 5 days',
  },
}

const MONA = {
  id: 7,
  name: 'Mona Ali',
  phone: '01011112222',
  date_of_birth: '1990-03-15',
  history: [
    { id: 1, type: 'allergy', title: 'Penicillin', details: 'rash', recorded_on: '2026-01-01' },
    { id: 2, type: 'condition', title: 'Diabetes', details: null, recorded_on: '2026-01-01' },
    { id: 3, type: 'surgery', title: 'Appendix', details: null, recorded_on: '2026-01-01' },
  ],
  address: 'Cairo',
  current_illness: null,
  outstanding_balance: '0.00',
  visits: [
    {
      id: 90,
      patient_id: 7,
      appointment_id: null,
      visit_date: '2026-10-04',
      work_done: 'Filling',
      total_amount: '500.00',
      paid: '500.00',
      remaining: '0.00',
      payment_status: 'paid',
      payments: [],
    },
  ],
}

const SAVED = { id: 55, patient_id: 7, visit_id: null, issued_on: '2026-10-05', notes: null, items: [] }

function fakeServer(patient = MONA) {
  vi.spyOn(patientsApi, 'getPatient').mockResolvedValue(patient)
  vi.spyOn(drugsApi, 'searchDrugs').mockImplementation(async (q) => {
    const text = q.toLowerCase()
    return [AUGMENTIN, FLAGYL].filter((drug) => drug.trade_name.toLowerCase().includes(text))
  })
  vi.spyOn(drugsApi, 'getDrug').mockImplementation(async (id) => FULL[id])
  return vi.spyOn(prescriptionsApi, 'createPrescription').mockResolvedValue(SAVED)
}

function renderForm(path = '/doctor/patients/7/prescriptions/new') {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt(path)
}

const line = (number) => screen.getByRole('group', { name: `Medication ${number}` })
const search = (number) => within(line(number)).getByRole('combobox')
const instructions = (number) => within(line(number)).getByLabelText(`Instructions for medication ${number}`)
const sideNote = () => screen.getByRole('complementary', { name: 'Drug note' })

/** Types in line `number`'s search and waits for `name` to be the highlighted result. */
async function searchFor(number, text, name) {
  await userEvent.type(search(number), text)
  await waitFor(() => expect(screen.getByRole('option', { selected: true })).toHaveTextContent(name))
}

/** Two catalogue drugs and one free-text line, using only the keyboard. */
async function writeThreeLines() {
  await screen.findByRole('group', { name: 'Medication 1' })

  await searchFor(1, 'aug', 'Augmentin 1 g')
  await userEvent.keyboard('{Enter}')
  expect(instructions(1)).toHaveFocus()
  await userEvent.keyboard('1 tablet every 12 hours{Enter}')

  await waitFor(() => expect(search(2)).toHaveFocus())
  await searchFor(2, 'flag', 'Flagyl 500 mg')
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await within(sideNote()).findByRole('button', { name: 'Use suggested dose' }))
  expect(instructions(2)).toHaveValue('1 tablet every 8 hours for 5 days')
  await userEvent.click(instructions(2))
  await userEvent.keyboard('{End}{Enter}')

  await waitFor(() => expect(search(3)).toHaveFocus())
  await userEvent.type(search(3), 'Mouthwash X')
  await userEvent.click(await screen.findByRole('option', { name: /Use as written/ }))
  await userEvent.type(instructions(3), 'Rinse twice daily')
}

describe('PrescriptionForm', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T14:20:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('shows the patient, age, today’s date and a reminder of allergies and conditions', async () => {
    fakeServer()
    renderForm()

    expect(await screen.findByRole('heading', { name: 'New prescription' })).toBeInTheDocument()
    expect(screen.getByText(/Age 36/)).toBeInTheDocument()
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-05')

    const reminder = screen.getByRole('note', { name: 'Check before prescribing' })
    expect(reminder).toHaveTextContent('Allergy: Penicillin — rash')
    expect(reminder).toHaveTextContent('Condition: Diabetes')
    expect(reminder).not.toHaveTextContent('Appendix')
  })

  it('hides the reminder box when the patient has no allergies or conditions', async () => {
    fakeServer({ ...MONA, history: [MONA.history[2]] })
    renderForm()

    await screen.findByRole('group', { name: 'Medication 1' })
    expect(screen.queryByRole('note', { name: 'Check before prescribing' })).not.toBeInTheDocument()
  })

  it('two catalogue drugs and a free-text line → the right POST body', async () => {
    const create = fakeServer()
    renderForm()

    await writeThreeLines()
    expect(within(line(3)).getByText('Not in the catalogue')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Notes'), 'Soft food for 2 days')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith(7, {
      visit_id: null,
      issued_on: '2026-10-05',
      notes: 'Soft food for 2 days',
      items: [
        { drug_id: 11, instructions: '1 tablet every 12 hours' },
        { drug_id: 21, instructions: '1 tablet every 8 hours for 5 days' },
        { drug_name: 'Mouthwash X', instructions: 'Rinse twice daily' },
      ],
    })
    await expectPath('/doctor/patients/7')
    expect(await screen.findByText('Prescription saved.')).toBeInTheDocument()
  })

  it('Save & Print goes to the print page', async () => {
    fakeServer()
    renderForm()

    await screen.findByRole('group', { name: 'Medication 1' })
    await searchFor(1, 'flag', 'Flagyl 500 mg')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('1 tablet every 8 hours')
    await userEvent.click(screen.getByRole('button', { name: 'Save & Print' }))

    await expectPath('/doctor/prescriptions/55/print')
  })

  it('the side note follows the focused line and its highlighted result', async () => {
    fakeServer()
    renderForm()

    expect(await screen.findByText('Pick or highlight a drug to see its note.')).toBeInTheDocument()

    await searchFor(1, 'aug', 'Augmentin 1 g')
    expect(await within(sideNote()).findByText('Augmentin uses')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}x{Enter}')

    await waitFor(() => expect(search(2)).toHaveFocus())
    expect(await within(sideNote()).findByText('Pick or highlight a drug to see its note.')).toBeInTheDocument()
    await searchFor(2, 'flag', 'Flagyl 500 mg')
    expect(await within(sideNote()).findByText('Flagyl uses')).toBeInTheDocument()
    expect(within(sideNote()).getByText('No alcohol')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')

    await userEvent.click(instructions(1))
    expect(await within(sideNote()).findByText('Augmentin uses')).toBeInTheDocument()
    await userEvent.click(within(sideNote()).getByRole('button', { name: 'Use suggested dose' }))
    expect(instructions(1)).toHaveValue('قرص كل 12 ساعة')
    expect(instructions(2)).toHaveValue('')

    await userEvent.click(instructions(2))
    expect(await within(sideNote()).findByText('Flagyl uses')).toBeInTheDocument()
  })

  it('checks RX-1 before sending: a drug needs instructions and a typed name must be picked', async () => {
    const create = fakeServer()
    renderForm()

    await screen.findByRole('group', { name: 'Medication 1' })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Add at least one medication.')).toBeInTheDocument()

    await searchFor(1, 'aug', 'Augmentin 1 g')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: '+ Add medication' }))
    await userEvent.type(search(2), 'Panadol')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(within(line(1)).getByText('Write the instructions for this medication.')).toBeInTheDocument()
    expect(within(line(2)).getByText('Choose a drug from the list, or use the name as written.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('shows the server’s 422 errors on their lines', async () => {
    const create = fakeServer()
    create.mockRejectedValue(
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 422,
        data: { message: 'Invalid', errors: { 'items.1.instructions': ['The instructions field is required.'] } },
      }),
    )
    renderForm()

    await writeThreeLines()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(line(2)).findByText('The instructions field is required.')).toBeInTheDocument()
    expect(within(line(1)).queryByText('The instructions field is required.')).not.toBeInTheDocument()
  })

  it('moves and removes lines, and stops at 15', async () => {
    const create = fakeServer()
    renderForm()

    await writeThreeLines()
    await userEvent.click(screen.getByRole('button', { name: 'Move medication 3 up' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove medication 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][1].items).toEqual([
      { drug_name: 'Mouthwash X', instructions: 'Rinse twice daily' },
      { drug_id: 21, instructions: '1 tablet every 8 hours for 5 days' },
    ])
  })

  it('allows at most 15 lines', async () => {
    fakeServer()
    renderForm()

    const add = await screen.findByRole('button', { name: '+ Add medication' })
    for (let i = 1; i < 15; i++) await userEvent.click(add)

    expect(screen.getAllByRole('group', { name: /^Medication \d+$/ })).toHaveLength(15)
    expect(add).toBeDisabled()
    expect(screen.getByText('A prescription can have up to 15 medications.')).toBeInTheDocument()
  })

  it('links the prescription to the visit from ?visit=', async () => {
    const create = fakeServer()
    renderForm('/doctor/patients/7/prescriptions/new?visit=90')

    expect(await screen.findByText('For the visit of 4 Oct 2026')).toBeInTheDocument()
    await searchFor(1, 'aug', 'Augmentin 1 g')
    await userEvent.keyboard('{Enter}x')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][1].visit_id).toBe(90)
  })

  it('edits a saved prescription with PUT', async () => {
    fakeServer()
    vi.spyOn(prescriptionsApi, 'getPrescription').mockResolvedValue({
      ...SAVED,
      visit_id: 90,
      issued_on: '2026-10-04',
      notes: 'Old notes',
      items: [
        { id: 1, position: 1, drug_id: 21, drug_name: 'Flagyl 500 mg', drug_form: 'tablets', instructions: 'Every 8 hours' },
        { id: 2, position: 2, drug_id: null, drug_name: 'Mouthwash X', drug_form: null, instructions: 'Rinse' },
      ],
    })
    const update = vi.spyOn(prescriptionsApi, 'updatePrescription').mockResolvedValue(SAVED)
    renderForm('/doctor/prescriptions/55/edit')

    expect(await screen.findByRole('heading', { name: 'Edit prescription' })).toBeInTheDocument()
    expect(within(line(1)).getByText('Flagyl 500 mg')).toBeInTheDocument()
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-04')

    await userEvent.click(within(line(2)).getByRole('button', { name: 'Change Mouthwash X' }))
    expect(search(2)).toHaveFocus()
    expect(search(2)).toHaveValue('Mouthwash X')
    await userEvent.clear(search(2))
    await searchFor(2, 'aug', 'Augmentin 1 g')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith(55, {
      visit_id: 90,
      issued_on: '2026-10-04',
      notes: 'Old notes',
      items: [
        { drug_id: 21, instructions: 'Every 8 hours' },
        { drug_id: 11, instructions: 'Rinse' },
      ],
    })
    expect(prescriptionsApi.getPrescription).toHaveBeenCalledWith('55')
    expect(patientsApi.getPatient).toHaveBeenCalledWith(7)
  })

  it('written from an unsaved visit: Save goes back to the visit form and records the prescription', async () => {
    const create = fakeServer()
    const url = '/doctor/visits/new?appointment=40'
    sessionStorage.setItem('clinic.visitDraft', JSON.stringify({ url, form: { work_done: 'Extraction' }, prescriptionIds: [], savedAt: Date.now() }))
    renderForm(`/doctor/patients/7/prescriptions/new?returnTo=${encodeURIComponent(url)}`)

    await screen.findByRole('group', { name: 'Medication 1' })
    await searchFor(1, 'aug', 'Augmentin 1 g')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(instructions(1), '1 tablet every 12 hours')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(create).toHaveBeenCalledWith(7, expect.objectContaining({ visit_id: null }))
    await expectPath('/doctor/visits/new')
    expect(JSON.parse(sessionStorage.getItem('clinic.visitDraft')).prescriptionIds).toEqual([55])
    sessionStorage.clear()
  })

  it('ignores a returnTo that is not the visit form', async () => {
    fakeServer()
    renderForm(`/doctor/patients/7/prescriptions/new?returnTo=${encodeURIComponent('https://evil.example')}`)

    await screen.findByRole('group', { name: 'Medication 1' })
    await searchFor(1, 'aug', 'Augmentin 1 g')
    await userEvent.keyboard('{Enter}')
    await userEvent.type(instructions(1), '1 tablet every 12 hours')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await expectPath('/doctor/patients/7')
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
    fakeServer()
    await expectNoA11yViolationsInBothLanguages(() => renderForm())
  })
})
