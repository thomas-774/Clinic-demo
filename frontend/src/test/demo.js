import * as authApi from '../api/auth'
import client, { setUnauthorizedHandler, tokenStorage } from '../api/client'
import { demoAdapter } from '../demo/adapter'
import * as db from '../demo/db'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demo/seed'

/**
 * Sends the API client to the fake backend (tests run with VITE_DEMO=false),
 * with a fresh demo database and no logged-in user.
 */
export function resetDemo() {
  client.defaults.adapter = demoAdapter
  setUnauthorizedHandler(() => {})
  localStorage.clear()
  db.unload()
  db.reset()
}

/** Logs in through the fake API as 'doctor', 'assistant' or 'patient'; returns the user. */
export async function loginAs(role) {
  const { token, user } = await authApi.login({ login: DEMO_ACCOUNTS[role], password: DEMO_PASSWORD })
  tokenStorage.set(token)
  return user
}

/** The axios error of a request that must fail. */
export const failure = (promise) =>
  promise.then(
    () => {
      throw new Error('expected the request to fail')
    },
    (error) => error.response,
  )

export { client, db }
