import * as auth from './handlers/auth'
import * as doctorPatients from './handlers/doctor/patients'
import * as doctorVisits from './handlers/doctor/visits'

/**
 * routes/api.php of the source app. `auth: false` is a public route;
 * `roles` is the role middleware (any logged-in user when left out).
 */
const DOCTOR = ['doctor']

const doctor = (method, path, handler) => ({ method, path: `/doctor${path}`, roles: DOCTOR, handler })

export const routes = [
  { method: 'GET', path: '/health', auth: false, handler: auth.health },

  { method: 'POST', path: '/auth/register', auth: false, handler: auth.register },
  { method: 'POST', path: '/auth/login', auth: false, handler: auth.login },
  { method: 'POST', path: '/auth/logout', handler: auth.logout },
  { method: 'GET', path: '/me', handler: auth.me },

  doctor('GET', '/patients', doctorPatients.index),
  doctor('POST', '/patients', doctorPatients.store),
  doctor('GET', '/patients/:patient', doctorPatients.show),
  doctor('PUT', '/patients/:patient', doctorPatients.update),
  doctor('POST', '/patients/:patient/history', doctorPatients.storeHistory),
  doctor('PUT', '/patients/:patient/history/:entry', doctorPatients.updateHistory),
  doctor('DELETE', '/patients/:patient/history/:entry', doctorPatients.destroyHistory),

  doctor('POST', '/visits', doctorVisits.store),
  doctor('PUT', '/visits/:visit', doctorVisits.update),
  doctor('POST', '/visits/:visit/payments', doctorVisits.storePayment),
]
