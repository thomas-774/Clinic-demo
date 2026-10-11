import { screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { vi } from 'vitest'
import * as appointmentsApi from '../api/appointments'
import * as authApi from '../api/auth'
import { tokenStorage } from '../api/client'
import * as patientApi from '../api/patient'
import * as slotsApi from '../api/slots'
import { profileKey } from '../hooks/useProfile'
import { renderAppAt } from '../test/renderApp'
import { warmStart } from './warmStart'

// T11-14 (NFR-P.5): a patient page's chunk and data start together with /me.
describe('warmStart', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('asks for the profile while /me is still on its way', async () => {
    tokenStorage.set('t')
    vi.spyOn(authApi, 'me').mockReturnValue(new Promise(() => {})) // never answers
    const getProfile = vi.spyOn(patientApi, 'getProfile').mockResolvedValue({ id: 1 })

    renderAppAt('/patient')

    await vi.waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('fetches what each patient page needs, under the keys its hooks read', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T05:00:00Z'))
    try {
      const queryClient = new QueryClient()
      vi.spyOn(patientApi, 'getProfile').mockResolvedValue({ id: 1 })
      const getSlots = vi.spyOn(slotsApi, 'getSlots').mockResolvedValue({ data: [], meta: {} })
      const getMine = vi.spyOn(appointmentsApi, 'getMyAppointments').mockResolvedValue({ upcoming: [], past: [] })

      expect(warmStart('/patient/', queryClient)).toBe(true)
      expect(warmStart('/patient/book', queryClient)).toBe(true)
      expect(warmStart('/patient/appointments', queryClient)).toBe(true)

      await vi.waitFor(() => expect(queryClient.getQueryData(profileKey)).toEqual({ id: 1 }))
      expect(getSlots).toHaveBeenCalledWith('2026-10-05')
      expect(getMine).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does nothing for other pages', () => {
    const queryClient = new QueryClient()
    const getProfile = vi.spyOn(patientApi, 'getProfile')

    expect(warmStart('/doctor', queryClient)).toBe(false)
    expect(warmStart('/login', queryClient)).toBe(false)
    expect(getProfile).not.toHaveBeenCalled()
  })
})
