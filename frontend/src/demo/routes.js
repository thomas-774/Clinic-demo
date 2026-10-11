import * as auth from './handlers/auth'

/**
 * routes/api.php of the source app. `auth: false` is a public route;
 * `roles` is the role middleware (any logged-in user when left out).
 */
export const routes = [
  { method: 'GET', path: '/health', auth: false, handler: auth.health },

  { method: 'POST', path: '/auth/register', auth: false, handler: auth.register },
  { method: 'POST', path: '/auth/login', auth: false, handler: auth.login },
  { method: 'POST', path: '/auth/logout', handler: auth.logout },
  { method: 'GET', path: '/me', handler: auth.me },
]
