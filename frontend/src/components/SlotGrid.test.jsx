import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'
import * as api from '../api/slots'
import { useSlots } from '../hooks/useSlots'
import SlotGrid from './SlotGrid'

const SLOTS = {
  '2026-10-06': [
    { start_at: '2026-10-06T17:00:00+03:00', end_at: '2026-10-06T17:45:00+03:00' },
    { start_at: '2026-10-06T17:45:00+03:00', end_at: '2026-10-06T18:30:00+03:00' },
    { start_at: '2026-10-06T18:30:00+03:00', end_at: '2026-10-06T19:15:00+03:00' },
  ],
  '2026-10-09': [],
}

/** A date picker + the grid, as the booking page wires them. */
function Picker({ initialDate }) {
  const [date, setDate] = useState(initialDate)
  const [selected, setSelected] = useState(null)
  const { data, isLoading } = useSlots(date)
  return (
    <>
      <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <SlotGrid slots={data?.data} loading={isLoading} selected={selected} onSelect={(slot) => setSelected(slot.start_at)} />
    </>
  )
}

function renderPicker(date = '2026-10-06') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Picker initialDate={date} />
    </QueryClientProvider>,
  )
}

describe('SlotGrid + useSlots', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getSlots').mockImplementation(async (date) => ({ data: SLOTS[date] ?? [], meta: { date, duration: 45 } }))
  })

  it('renders a button per free slot with the time in clinic time', async () => {
    renderPicker()

    const grid = await screen.findByRole('group', { name: 'Free times' })
    expect(api.getSlots).toHaveBeenCalledWith('2026-10-06')
    expect(grid.querySelectorAll('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '17:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '18:30' })).toBeInTheDocument()
  })

  it('highlights the selected slot only', async () => {
    renderPicker()

    await userEvent.click(await screen.findByRole('button', { name: '17:45' }))

    expect(screen.getByRole('button', { name: '17:45' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '17:00' })).toHaveAttribute('aria-pressed', 'false')
    // Not by colour alone (WCAG 1.4.1): a check mark, which screen readers skip (they hear "pressed").
    expect(screen.getByRole('button', { name: '17:45' })).toHaveTextContent('✓ 17:45')
    expect(screen.getByRole('button', { name: '17:00' })).not.toHaveTextContent('✓')
  })

  it('shows the empty state for a day without slots', async () => {
    renderPicker('2026-10-09')

    expect(await screen.findByText('No free slots on this day.')).toBeInTheDocument()
  })

  it('shows a skeleton while loading', () => {
    api.getSlots.mockReturnValue(new Promise(() => {}))
    renderPicker()

    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument()
    expect(screen.getAllByTestId('slot-skeleton').length).toBeGreaterThan(0)
  })

  it('does not fetch until a date is chosen', () => {
    renderPicker('')

    expect(api.getSlots).not.toHaveBeenCalled()
  })
})
