import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as api from '../api/drugs'
import DrugInfoPanel from './DrugInfoPanel'

const AUGMENTIN = {
  id: 11,
  trade_name: 'Augmentin 1 g',
  form: 'tablets',
  pack: '14 tabs',
  category: 'antibiotic',
  active_ingredients: [
    { name: 'amoxicillin', note: 'مضاد حيوي' },
    { name: 'clavulanic acid', note: null },
  ],
  uses: 'مضاد حيوي واسع المجال\nلعلاج خراج الأسنان',
  warnings: 'لا يؤخذ في حالة الحساسية من البنسلين',
  suggested_dose: 'قرص كل 12 ساعة بعد الأكل لمدة 5 أيام',
  source_page: 24,
  is_active: true,
}

function renderPanel(props = {}) {
  const onUseDose = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <DrugInfoPanel onUseDose={onUseDose} {...props} />
    </QueryClientProvider>,
  )
  return { onUseDose, panel: screen.getByRole('complementary', { name: 'Drug note' }), ...view }
}

describe('DrugInfoPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getDrug').mockImplementation(async (id) => {
      if (id === 11) return AUGMENTIN
      if (id === 12) return { ...AUGMENTIN, id: 12, trade_name: 'Panadol', warnings: null, suggested_dose: null }
      throw new Error('not found')
    })
  })

  it('shows the name, form · pack, category, uses, warnings and ingredients', async () => {
    const { panel } = renderPanel({ drugId: 11 })

    expect(await within(panel).findByText(/مضاد حيوي واسع المجال/)).toBeInTheDocument()
    expect(api.getDrug).toHaveBeenCalledWith(11)
    expect(within(panel).getByRole('heading', { name: 'Augmentin 1 g' })).toBeInTheDocument()
    expect(panel).toHaveTextContent('tablets · 14 tabs')
    expect(panel).toHaveTextContent('Antibiotic')
    expect(panel).toHaveTextContent('Uses')

    const warnings = within(panel).getByRole('note', { name: 'Warnings' })
    expect(warnings).toHaveTextContent('لا يؤخذ في حالة الحساسية من البنسلين')
    expect(warnings.className).toContain('bg-red-50')

    const ingredients = within(panel).getAllByRole('listitem')
    expect(ingredients).toHaveLength(2)
    expect(ingredients[0]).toHaveTextContent('amoxicillin — مضاد حيوي')
    expect(ingredients[1]).toHaveTextContent('clavulanic acid')
    expect(ingredients[1]).not.toHaveTextContent('—')

    expect(panel).toHaveTextContent('قرص كل 12 ساعة بعد الأكل لمدة 5 أيام')
  })

  it('has no warnings box and no dose button when they are empty', async () => {
    const { panel } = renderPanel({ drugId: 12 })

    await within(panel).findByRole('heading', { name: 'Panadol' })
    await within(panel).findByText('Active ingredients')
    expect(within(panel).queryByRole('note')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Use suggested dose' })).not.toBeInTheDocument()
  })

  it('sends the suggested dose with the button', async () => {
    const { panel, onUseDose } = renderPanel({ drugId: 11 })

    await userEvent.click(await within(panel).findByRole('button', { name: 'Use suggested dose' }))

    expect(onUseDose).toHaveBeenCalledWith('قرص كل 12 ساعة بعد الأكل لمدة 5 أيام')
  })

  it('shows the search result while the full drug loads', async () => {
    let resolve
    api.getDrug.mockImplementation(() => new Promise((r) => (resolve = r)))
    const preview = { id: 11, trade_name: 'Augmentin 1 g', form: 'tablets', pack: '14 tabs', category: 'antibiotic', short_use: 'x' }

    const { panel } = renderPanel({ drugId: 11, preview })

    expect(within(panel).getByRole('heading', { name: 'Augmentin 1 g' })).toBeInTheDocument()
    expect(within(panel).getByRole('status')).toHaveTextContent('Loading…')

    resolve(AUGMENTIN)
    expect(await within(panel).findByRole('note', { name: 'Warnings' })).toBeInTheDocument()
  })

  it('ignores a preview for another drug', () => {
    api.getDrug.mockImplementation(() => new Promise(() => {}))
    const { panel } = renderPanel({ drugId: 11, preview: { id: 99, trade_name: 'Other' } })

    expect(within(panel).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows the empty state with no drug', () => {
    const { panel } = renderPanel()

    expect(panel).toHaveTextContent('Pick or highlight a drug to see its note.')
    expect(api.getDrug).not.toHaveBeenCalled()
  })

  it('marks a free-text line as not in the catalogue', () => {
    const { panel } = renderPanel({ freeText: 'Warm salt water' })

    expect(within(panel).getByRole('heading', { name: 'Warm salt water' })).toBeInTheDocument()
    expect(panel).toHaveTextContent('Not in the catalogue')
    expect(api.getDrug).not.toHaveBeenCalled()
  })

  it('offers a retry when loading fails', async () => {
    const { panel } = renderPanel({ drugId: 404 })

    expect(await within(panel).findByRole('alert')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('sticks beside the form on wide screens', () => {
    const { panel } = renderPanel()

    expect(panel.className).toContain('lg:sticky')
  })

  it('follows a new drug id', async () => {
    const { panel, rerender } = renderPanel({ drugId: 11 })
    await within(panel).findByRole('heading', { name: 'Augmentin 1 g' })

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <DrugInfoPanel drugId={12} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Panadol' })).toBeInTheDocument()
  })
})
