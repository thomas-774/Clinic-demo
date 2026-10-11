import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../api/auth'
import { tokenStorage } from '../api/client'
import * as reportsApi from '../api/reports'
import { expectPath, renderAppAt } from '../test/renderApp'
import { isChunkLoadError } from '../utils/chunkLoad'
import ErrorBoundary from './ErrorBoundary'

/* T7-03: a crashed page shows a way out instead of a blank screen. */

const crash = vi.hoisted(() => ({ on: true }))

// The Reports page crashes while rendering for as long as crash.on is true.
vi.mock('../pages/doctor/Reports', () => ({
  default: function Reports() {
    if (crash.on) throw new Error('boom')
    return <h1>Reports page</h1>
  },
}))

function Thrower({ error }) {
  throw error
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    crash.on = true
    // React and the boundary log the caught error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('keeps the menu when a page crashes, retries the page, and clears on navigation', async () => {
    tokenStorage.set('t')
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
    vi.spyOn(reportsApi, 'getReportSummary').mockResolvedValue({ from: '2026-10-05', to: '2026-10-05', visits: 0, revenue: '0.00', outstanding: '0.00' })
    renderAppAt('/doctor/reports')

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText('This page could not be shown. Try again, or go back to the start.')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()

    crash.on = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Reports page' })).toBeInTheDocument()

    crash.on = true
    await userEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
    await expectPath('/doctor')
    await userEvent.click(screen.getByRole('link', { name: 'Reports' }))
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Something went wrong' })).not.toBeInTheDocument()
  })

  it('asks for a reload when a page could not be downloaded', async () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload })
    const error = new TypeError('Failed to fetch dynamically imported module: https://clinic.example/assets/Reports-1a2b.js')

    render(
      <ErrorBoundary fullPage>
        <Thrower error={error} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('This page could not be downloaded. Check your connection, then reload.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Go to the start' })).toHaveAttribute('href', '/')
  })

  it('recognises the chunk errors of the main browsers', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js'))).toBe(true) // Chrome, Edge
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: /a.js'))).toBe(true) // Firefox
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true) // Safari
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('OfflineBanner', () => {
  let online
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  })

  it('appears while the device is offline and goes away when it is back', async () => {
    renderAppAt('/login')
    const message = 'You are offline. What is on screen stays; saving waits until the connection is back.'
    await screen.findByRole('heading', { name: 'Log in' })
    expect(screen.queryByText(message)).not.toBeInTheDocument()

    online = false
    act(() => window.dispatchEvent(new Event('offline')))
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.getByText(message).parentElement).toHaveAttribute('aria-live', 'polite')

    online = true
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.queryByText(message)).not.toBeInTheDocument()
  })
})
