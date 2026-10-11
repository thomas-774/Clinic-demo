import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tokenStorage } from '../../api/client'
import { homePathFor, useAuth } from '../../auth/useAuth'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../accounts'
import { resetDemoData } from '../control'

/**
 * Logging in as a demo role and resetting the demo data.
 * `busy` is the action running ('doctor', 'reset', …) or null.
 */
export function useDemoSession() {
  const { login, role } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)

  const run = useCallback(async (name, action) => {
    setBusy(name)
    try {
      return await action()
    } finally {
      setBusy(null)
    }
  }, [])

  /** Logs in as the demo account of `next` and opens its home page. */
  const enterAs = useCallback(
    (next) =>
      run(next, async () => {
        const user = await login({ login: DEMO_ACCOUNTS[next], password: DEMO_PASSWORD })
        // Nothing cached for the previous role may show to the next one.
        queryClient.clear()
        navigate(homePathFor(user.role), { replace: true })
        return user
      }),
    [login, navigate, queryClient, run],
  )

  /** Puts the seed back and reopens the current role's home page with fresh data. */
  const resetData = useCallback(
    () =>
      run('reset', async () => {
        await resetDemoData({ token: tokenStorage.get(), role })
        queryClient.clear()
        if (role) {
          const user = await login({ login: DEMO_ACCOUNTS[role], password: DEMO_PASSWORD })
          navigate(homePathFor(user.role), { replace: true })
        }
      }),
    [login, navigate, queryClient, role, run],
  )

  return { busy, enterAs, resetData }
}
