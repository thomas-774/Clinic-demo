import { screen } from '@testing-library/react'
import { vi } from 'vitest'
import * as authApi from './api/auth'
import { tokenStorage } from './api/client'
import * as patientApi from './api/patient'
import * as lazyPages from './pages/lazyPages'
import { renderAppAt } from './test/renderApp'

// T11-10: role pages are separate chunks, loaded on demand and prefetched after login.
describe('lazy role pages', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('load their chunk on demand and remember it once it is in (T11-14)', async () => {
    for (const page of [lazyPages.PatientHome, lazyPages.Dashboard, lazyPages.Reports, lazyPages.AssistantToday]) {
      expect(page.load).toEqual(expect.any(Function))
    }
    const module = await lazyPages.Reports.load()
    // Rendered directly from now on: no second suspend, no held-back paint.
    expect(lazyPages.Reports.load.module).toBe(module)
    expect(lazyPages.loaders.doctor.Reports).toBe(lazyPages.Reports.load)
  })

  it('renders a lazily loaded page and prefetches the rest of the role', async () => {
    const prefetch = vi.spyOn(lazyPages, 'prefetchRolePages')
    tokenStorage.set('t')
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: 5, name: 'Mona Ali', role: 'patient', patient_id: 1 })
    vi.spyOn(patientApi, 'getProfile').mockResolvedValue({
      id: 1,
      name: 'Mona Ali',
      phone: '01012345678',
      email: null,
      address: '12 Tahrir St',
      date_of_birth: null,
      gender: 'female',
      current_illness: null,
      simple_history: [],
      next_appointment: null,
      outstanding_balance: '0.00',
      unpaid_visits: [],
    })

    renderAppAt('/patient')

    expect(await screen.findByRole('heading', { name: 'Hello, Mona Ali' })).toBeInTheDocument()
    // Only once the page is up (T11-14).
    expect(prefetch).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(prefetch).toHaveBeenCalledWith('patient'), { timeout: lazyPages.PREFETCH_DELAY_MS + 1000 })
    expect(prefetch).not.toHaveBeenCalledWith('doctor')
  })

  it('does not prefetch for a logged-out visitor', async () => {
    const prefetch = vi.spyOn(lazyPages, 'prefetchRolePages')

    renderAppAt('/login')

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('prefetch loads every page of the role', async () => {
    const assistant = await lazyPages.prefetchRolePages('assistant')
    expect(assistant).toHaveLength(4)
    assistant.forEach((module) => expect(module.default).toEqual(expect.any(Function)))

    expect(await lazyPages.prefetchRolePages('nobody')).toEqual([])
  })
})
