import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../../api/auth'
import { tokenStorage } from '../../../api/client'
import * as drugsApi from '../../../api/drugs'
import * as settingsApi from '../../../api/settings'
import { expectPath, renderAppAt } from '../../../test/renderApp'

const FLAGYL = {
  id: 21,
  trade_name: 'Flagyl 500 mg',
  form: 'tablets',
  pack: '20 tabs',
  category: 'antibiotic',
  active_ingredients: [{ name: 'metronidazole', note: 'مضاد للميكروبات' }],
  uses: 'Flagyl uses',
  warnings: 'No alcohol',
  suggested_dose: '1 tablet every 8 hours',
  source_page: 9,
  is_active: true,
}
const ORAL_B = { ...FLAGYL, id: 5, trade_name: 'Oral-B mouthwash', form: 'mouthwash', pack: null, category: 'mouth_cleaning', is_active: false }

/** In-memory catalogue that filters like GET /doctor/drugs. */
function fakeServer() {
  let drugs = [FLAGYL, ORAL_B]
  vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ slot_duration_minutes: 45, booking_window_days: 30, cancel_cutoff_hours: 2 })
  vi.spyOn(settingsApi, 'getWorkingHours').mockResolvedValue([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day_of_week: day, ranges: [] })))
  vi.spyOn(settingsApi, 'getBlockedTimes').mockResolvedValue([])
  vi.spyOn(settingsApi, 'getStaff').mockResolvedValue([])
  const list = vi.spyOn(drugsApi, 'listDrugs').mockImplementation(async ({ search, category, includeHidden, page }) => {
    const rows = drugs.filter(
      (d) =>
        (includeHidden || d.is_active) &&
        (!category || d.category === category) &&
        (!search || d.trade_name.toLowerCase().includes(search.toLowerCase())),
    )
    return { data: rows, meta: { current_page: page, last_page: 1, total: rows.length } }
  })
  const create = vi.spyOn(drugsApi, 'createDrug').mockImplementation(async (fields) => {
    const drug = { id: 99, is_active: true, source_page: null, ...fields }
    drugs = [...drugs, drug]
    return drug
  })
  const update = vi.spyOn(drugsApi, 'updateDrug').mockImplementation(async (id, fields) => {
    drugs = drugs.map((d) => (d.id === id ? { ...d, ...fields } : d))
    return drugs.find((d) => d.id === id)
  })
  return { list, create, update }
}

function renderTab() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/settings?tab=drugs')
}

const table = () => screen.getByRole('table')
const rowOf = (name) => within(table()).getByText(name).closest('tr')

describe('Settings → Drugs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('lists active drugs with form, section and status; "show hidden" adds the hidden ones', async () => {
    const { list } = fakeServer()
    renderTab()

    expect(await screen.findByRole('tab', { name: 'Drugs', selected: true })).toBeInTheDocument()
    expect(await within(await screen.findByRole('table')).findByText('Flagyl 500 mg')).toBeInTheDocument()
    expect(rowOf('Flagyl 500 mg')).toHaveTextContent('tablets · 20 tabs')
    expect(rowOf('Flagyl 500 mg')).toHaveTextContent('Antibiotic')
    expect(rowOf('Flagyl 500 mg')).toHaveTextContent('Active')
    expect(within(table()).queryByText('Oral-B mouthwash')).not.toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith({ search: '', category: '', includeHidden: false, page: 1 })

    await userEvent.click(screen.getByLabelText('Show hidden drugs'))
    expect(await within(table()).findByText('Oral-B mouthwash')).toBeInTheDocument()
    expect(rowOf('Oral-B mouthwash')).toHaveTextContent('Hidden')
    expect(list).toHaveBeenLastCalledWith({ search: '', category: '', includeHidden: true, page: 1 })
  })

  it('searches after typing stops and filters by section', async () => {
    const { list } = fakeServer()
    renderTab()

    await within(await screen.findByRole('table')).findByText('Flagyl 500 mg')
    await userEvent.type(screen.getByLabelText('Search drugs'), 'zzz')
    expect(await screen.findByText('No drugs match.')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith({ search: 'zzz', category: '', includeHidden: false, page: 1 })

    await userEvent.clear(screen.getByLabelText('Search drugs'))
    await userEvent.selectOptions(screen.getByLabelText('Section'), 'Mouth cleaning')
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ search: '', category: 'mouth_cleaning', includeHidden: false, page: 1 }))
  })

  it('adding a drug posts the right body', async () => {
    const { create } = fakeServer()
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Add drug' }))
    const dialog = screen.getByRole('dialog', { name: 'Add a drug' })
    await userEvent.type(within(dialog).getByLabelText('Trade name'), 'Ketolac 10 mg')
    await userEvent.type(within(dialog).getByLabelText('Form'), 'tablets')
    await userEvent.type(within(dialog).getByLabelText('Strength / pack'), '20 tabs')
    await userEvent.selectOptions(within(dialog).getByLabelText('Section'), 'Analgesic / sedative')
    await userEvent.type(within(dialog).getByLabelText('Ingredient 1'), 'ketorolac')
    await userEvent.type(within(dialog).getByLabelText('Note for ingredient 1'), 'مسكن قوي')
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Add ingredient' }))
    await userEvent.type(within(dialog).getByLabelText('Ingredient 2'), 'lactose')
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Add ingredient' }))
    await userEvent.type(within(dialog).getByLabelText('Uses'), 'Pain after extraction')
    await userEvent.type(within(dialog).getByLabelText('Suggested dose'), '1 tablet every 8 hours')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(create).toHaveBeenCalledWith({
      trade_name: 'Ketolac 10 mg',
      form: 'tablets',
      pack: '20 tabs',
      category: 'analgesic_sedative',
      active_ingredients: [
        { name: 'ketorolac', note: 'مسكن قوي' },
        { name: 'lactose', note: null },
      ],
      uses: 'Pain after extraction',
      warnings: null,
      suggested_dose: '1 tablet every 8 hours',
    })
    expect(await screen.findByText('Ketolac 10 mg was added to the catalogue.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await within(table()).findByText('Ketolac 10 mg')).toBeInTheDocument()
  })

  it('shows 422 errors next to their fields and ingredients', async () => {
    const { create } = fakeServer()
    create.mockRejectedValueOnce(
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 422,
        data: {
          message: 'Invalid',
          errors: { uses: ['The uses field is required.'], 'active_ingredients.0.name': ['The ingredient name is too long.'] },
        },
      }),
    )
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Add drug' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Ingredient 1'), 'x')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await within(dialog).findByText('The uses field is required.')).toBeInTheDocument()
    expect(within(dialog).getByText('The ingredient name is too long.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Ingredient 1')).toHaveAttribute('aria-invalid', 'true')
  })

  it('edits a drug with all its fields', async () => {
    const { update } = fakeServer()
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Flagyl 500 mg' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Flagyl 500 mg' })
    expect(within(dialog).getByLabelText('Ingredient 1')).toHaveValue('metronidazole')
    expect(within(dialog).getByLabelText('Warnings')).toHaveValue('No alcohol')
    await userEvent.clear(within(dialog).getByLabelText('Warnings'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove ingredient 1' }))
    expect(within(dialog).getByRole('button', { name: 'Remove ingredient 1' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(update).toHaveBeenCalledWith(21, {
      trade_name: 'Flagyl 500 mg',
      form: 'tablets',
      pack: '20 tabs',
      category: 'antibiotic',
      active_ingredients: [{ name: 'metronidazole', note: 'مضاد للميكروبات' }],
      uses: 'Flagyl uses',
      warnings: null,
      suggested_dose: '1 tablet every 8 hours',
    })
    expect(await screen.findByText('Flagyl 500 mg was saved.')).toBeInTheDocument()
  })

  it('hiding calls PUT with is_active: false, and showing with true', async () => {
    const { update } = fakeServer()
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Hide Flagyl 500 mg' }))
    expect(update).toHaveBeenCalledWith(21, { is_active: false })
    expect(await screen.findByText('Flagyl 500 mg is hidden and will no longer be suggested.')).toBeInTheDocument()
    expect(await screen.findByText('No drugs match.')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Show hidden drugs'))
    await userEvent.click(await screen.findByRole('button', { name: 'Show Oral-B mouthwash' }))
    expect(update).toHaveBeenLastCalledWith(5, { is_active: true })
  })

  it('switches tabs with the keyboard and keeps the tab in the URL', async () => {
    fakeServer()
    renderTab()

    const drugs = await screen.findByRole('tab', { name: 'Drugs' })
    act(() => drugs.focus())
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Prescription' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Prescription' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Hours & booking' })).toHaveAttribute('aria-selected', 'true')
    await expectPath('/doctor/settings')
  })
})
