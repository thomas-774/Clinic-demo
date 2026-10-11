import { DEMO_ACCOUNTS } from './accounts'

/**
 * What the demo bar can do to the fake backend. The backend is loaded on
 * demand, like the adapter does, so the bar adds nothing to the first page.
 */

/**
 * Puts the seed back. The session survives: `token` is given back to the
 * demo account of `role`, so requests already on their way do not get 401.
 */
export async function resetDemoData({ token, role } = {}) {
  const db = await import('./db')
  db.reset()
  const account = role ? db.first('users', { phone: DEMO_ACCOUNTS[role] }) : null
  if (token && account) {
    db.insert('tokens', { user_id: account.id, name: 'api', token, last_used_at: null })
    db.save()
  }
}
