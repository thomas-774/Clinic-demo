import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

const HOMES = { doctor: '/doctor', assistant: '/assistant' }

/** Where each role lands after login (§7.2). */
export function homePathFor(role) {
  return HOMES[role] ?? '/patient'
}

/**
 * Where a user goes after logging in: back to the page that sent them to
 * /login (`from`) when it is inside their own area, otherwise their home.
 */
export function landingPathFor(user, from) {
  const home = homePathFor(user.role)
  return from && (from === home || from.startsWith(`${home}/`)) ? from : home
}

/** `{ user, role, loading, login, register, logout }` from <AuthProvider>. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
