import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as api from '../api/drugs'
import i18next from '../i18n'
import DrugSearch from './DrugSearch'

const AUGMENTIN = [
  { id: 11, trade_name: 'Augmentin 1 g', form: 'tablets', pack: '14 tabs', category: 'antibiotic', short_use: 'مضاد حيوي واسع المجال' },
  { id: 12, trade_name: 'Augmentin 625 mg', form: 'tablets', pack: '14 tabs', category: 'antibiotic', short_use: 'مضاد حيوي' },
  { id: 13, trade_name: 'Hibiotic 1 g', form: 'tablets', pack: null, category: 'antibiotic', short_use: 'مضاد حيوي' },
]

function renderSearch(props = {}) {
  const handlers = { onSelect: vi.fn(), onFreeText: vi.fn(), onHighlight: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <DrugSearch {...handlers} {...props} />
    </QueryClientProvider>,
  )
  return { ...handlers, input: screen.getByRole('combobox', { name: 'Medication' }) }
}

/** Lets the 250 ms debounce pass without a request being expected. */
const pause = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

describe('DrugSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'searchDrugs').mockImplementation(async (q) =>
      q.toLowerCase().startsWith('aug') ? AUGMENTIN : [],
    )
  })

  it('makes no request for 1 character', async () => {
    const { input } = renderSearch()

    await userEvent.type(input, 'a')
    await pause(400)

    expect(api.searchDrugs).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows results for "aug" with the typed part in bold, form · pack and the short use', async () => {
    const { input } = renderSearch()

    await userEvent.type(input, 'aug')

    const list = await screen.findByRole('listbox', { name: 'Matching drugs' })
    const options = await within(list).findAllByRole('option')
    expect(options).toHaveLength(3)
    expect(api.searchDrugs).toHaveBeenLastCalledWith('aug')
    expect(options[0]).toHaveTextContent('Augmentin 1 g')
    expect(options[0]).toHaveTextContent('tablets · 14 tabs')
    expect(options[0]).toHaveTextContent('مضاد حيوي واسع المجال')
    expect(options[0].querySelector('strong')).toHaveTextContent('Aug')
    expect(options[2].querySelector('strong')).toBeNull()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('debounces: one request after typing stops', async () => {
    const { input } = renderSearch()

    await userEvent.type(input, 'augmen')
    await screen.findAllByRole('option')

    expect(api.searchDrugs).toHaveBeenCalledTimes(1)
    expect(api.searchDrugs).toHaveBeenCalledWith('augmen')
  })

  it('picks the second result with ↓ then Enter', async () => {
    const { input, onSelect } = renderSearch()

    await userEvent.type(input, 'aug')
    await screen.findAllByRole('option')
    await userEvent.keyboard('{ArrowDown}')

    const second = screen.getAllByRole('option')[1]
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', second.id)

    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(AUGMENTIN[1])
    expect(input).toHaveValue('Augmentin 625 mg')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('moves up with ↑, wrapping to the last result', async () => {
    const { input, onSelect } = renderSearch()

    await userEvent.type(input, 'aug')
    await screen.findAllByRole('option')
    await userEvent.keyboard('{ArrowUp}{Enter}')

    expect(onSelect).toHaveBeenCalledWith(AUGMENTIN[2])
  })

  it('picks with the mouse', async () => {
    const { input, onSelect } = renderSearch()

    await userEvent.type(input, 'aug')
    await userEvent.click(await screen.findByRole('option', { name: /Hibiotic/ }))

    expect(onSelect).toHaveBeenCalledWith(AUGMENTIN[2])
  })

  it('closes with Esc and opens again with ↓', async () => {
    const { input } = renderSearch()

    await userEvent.type(input, 'aug')
    await screen.findAllByRole('option')
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('offers the typed name as written when nothing matches', async () => {
    const { input, onFreeText, onSelect } = renderSearch()

    await userEvent.type(input, 'Warm salt water')

    const option = await screen.findByRole('option', { name: /Use as written/ })
    expect(option).toHaveTextContent('“Warm salt water”')

    await userEvent.keyboard('{Enter}')

    expect(onFreeText).toHaveBeenCalledWith('Warm salt water')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('calls onHighlight for the highlighted drug as it moves', async () => {
    const { input, onHighlight } = renderSearch()

    await userEvent.type(input, 'aug')
    await screen.findAllByRole('option')
    await waitFor(() => expect(onHighlight).toHaveBeenLastCalledWith(AUGMENTIN[0]))

    await userEvent.keyboard('{ArrowDown}')
    expect(onHighlight).toHaveBeenLastCalledWith(AUGMENTIN[1])

    await userEvent.hover(screen.getAllByRole('option')[2])
    expect(onHighlight).toHaveBeenLastCalledWith(AUGMENTIN[2])

    await userEvent.keyboard('{Escape}')
    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })

  it('renders drug names with dir="auto" and works in Arabic', async () => {
    await i18next.changeLanguage('ar')
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <DrugSearch />
      </QueryClientProvider>,
    )
    const input = screen.getByRole('combobox', { name: 'الدواء' })
    expect(input).toHaveAttribute('dir', 'auto')

    await userEvent.type(input, 'aug')
    const list = await screen.findByRole('listbox', { name: 'الأدوية المطابقة' })
    expect((await within(list).findAllByRole('option'))[0].querySelector('[dir="auto"]')).toHaveTextContent('Augmentin 1 g')
    expect(list.className).toContain('inset-x-0')
  })
})
