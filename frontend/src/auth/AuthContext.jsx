import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import * as authApi from '../api/auth'
import { setUnauthorizedHandler, tokenStorage } from '../api/client'
import { warmStart } from '../pages/warmStart'
import { AuthContext } from './useAuth'

/** No answer at all (offline), or the server failed (5xx). */
function isUnreachable(error) {
  return Boolean(error?.isAxiosError) && (!error.response || error.response.status >= 500)
}

/** Shown instead of the app when the stored token could not be checked. */
function ServerUnreachable({ onRetry }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div role="alert" className="max-w-md rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <h1 className="text-lg font-bold text-slate-900">{t('common.appName')}</h1>
        <p className="mt-2 text-slate-600">{t('common.networkError')}</p>
        <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-lg bg-sky-700 px-4 font-semibold text-white hover:bg-sky-800">
          {t('common.retry')}
        </button>
      </div>
    </div>
  )
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState(null)
  // With a stored token we must ask /me before deciding where the user belongs.
  const [loading, setLoading] = useState(() => Boolean(tokenStorage.get()))
  // The page the app was opened on, for warmStart().
  const firstPath = useRef(useLocation().pathname)
  // The stored token could not be checked because the server could not be reached.
  const [unreachable, setUnreachable] = useState(false)

  // Asks /me who the stored token belongs to. Returns a cleanup for effects.
  const checkStoredToken = useCallback(() => {
    let cancelled = false
    authApi
      .me()
      .then((me) => !cancelled && setUser(me))
      .catch((error) => {
        if (cancelled) return
        setUser(null)
        // Offline or the server is down: the token may be fine, so keep it and
        // offer a retry instead of the login page. A rejected token is already
        // cleared by the client's 401 handling.
        setUnreachable(isUnreachable(error))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // An expired or revoked token: forget the user; route guards send them to /login.
    setUnauthorizedHandler(() => {
      setUser(null)
      queryClient.clear()
    })

    if (!tokenStorage.get()) return
    warmStart(firstPath.current, queryClient)
    return checkStoredToken()
  }, [queryClient, checkStoredToken])

  const retryStoredToken = useCallback(() => {
    setLoading(true)
    setUnreachable(false)
    checkStoredToken()
  }, [checkStoredToken])

  const startSession = useCallback(({ token, user }) => {
    tokenStorage.set(token)
    setUser(user)
    return user
  }, [])

  const login = useCallback((credentials) => authApi.login(credentials).then(startSession), [startSession])

  const register = useCallback((fields) => authApi.register(fields).then(startSession), [startSession])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // The token may already be invalid; log out locally anyway.
    } finally {
      tokenStorage.clear()
      setUser(null)
      // Drop cached data so the next person on this browser never sees it.
      queryClient.clear()
    }
  }, [queryClient])

  const value = useMemo(
    () => ({ user, role: user?.role ?? null, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return (
    <AuthContext.Provider value={value}>
      {unreachable ? <ServerUnreachable onRetry={retryStoredToken} /> : children}
    </AuthContext.Provider>
  )
}
