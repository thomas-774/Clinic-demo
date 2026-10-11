import * as assistantArea from './handlers/assistant'
import * as auth from './handlers/auth'
import * as drugs from './handlers/doctor/drugs'
import * as doctorPatients from './handlers/doctor/patients'
import * as prescriptions from './handlers/doctor/prescriptions'
import * as reports from './handlers/doctor/reports'
import * as settings from './handlers/doctor/settings'
import * as doctorVisits from './handlers/doctor/visits'
import * as patientArea from './handlers/patient'
import * as schedule from './handlers/schedule'

/**
 * routes/api.php of the source app. `auth: false` is a public route;
 * `roles` is the role middleware (any logged-in user when left out).
 */
const DOCTOR = ['doctor']
const ASSISTANT = ['assistant']
const PATIENT = ['patient']

const doctor = (method, path, handler) => ({ method, path: `/doctor${path}`, roles: DOCTOR, handler })
const assistant = (method, path, handler) => ({ method, path: `/assistant${path}`, roles: ASSISTANT, handler })
const patient = (method, path, handler) => ({ method, path: `/patient${path}`, roles: PATIENT, handler })

export const routes = [
  { method: 'GET', path: '/health', auth: false, handler: auth.health },

  { method: 'POST', path: '/auth/register', auth: false, handler: auth.register },
  { method: 'POST', path: '/auth/login', auth: false, handler: auth.login },
  { method: 'POST', path: '/auth/logout', handler: auth.logout },
  { method: 'GET', path: '/me', handler: auth.me },
  { method: 'GET', path: '/slots', roles: ['patient', 'doctor', 'assistant'], handler: schedule.slotList },

  patient('GET', '/profile', patientArea.show),
  patient('PATCH', '/profile', patientArea.update),
  patient('GET', '/appointments', schedule.patientIndex),
  patient('POST', '/appointments', schedule.patientBook),
  patient('PATCH', '/appointments/:appointment/cancel', schedule.patientCancel),

  doctor('GET', '/patients', doctorPatients.index),
  doctor('POST', '/patients', doctorPatients.store),
  doctor('GET', '/patients/:patient', doctorPatients.show),
  doctor('PUT', '/patients/:patient', doctorPatients.update),
  doctor('POST', '/patients/:patient/history', doctorPatients.storeHistory),
  doctor('PUT', '/patients/:patient/history/:entry', doctorPatients.updateHistory),
  doctor('DELETE', '/patients/:patient/history/:entry', doctorPatients.destroyHistory),

  doctor('GET', '/appointments', schedule.staffSchedule),
  doctor('POST', '/appointments', schedule.staffBook),
  doctor('PATCH', '/appointments/:appointment/status', schedule.doctorStatus),

  doctor('POST', '/visits', doctorVisits.store),
  doctor('PUT', '/visits/:visit', doctorVisits.update),
  doctor('POST', '/visits/:visit/payments', doctorVisits.storePayment),

  doctor('GET', '/patients/:patient/prescriptions', prescriptions.index),
  doctor('POST', '/patients/:patient/prescriptions', prescriptions.store),
  doctor('GET', '/prescriptions/:prescription', prescriptions.show),
  doctor('PUT', '/prescriptions/:prescription', prescriptions.update),
  doctor('DELETE', '/prescriptions/:prescription', prescriptions.destroy),

  // /drugs/search before /drugs/:drug, like the source's route order.
  doctor('GET', '/drugs/search', drugs.search),
  doctor('GET', '/drugs', drugs.index),
  doctor('POST', '/drugs', drugs.store),
  doctor('GET', '/drugs/:drug', drugs.show),
  doctor('PUT', '/drugs/:drug', drugs.update),

  doctor('GET', '/reports/summary', reports.summary),
  doctor('GET', '/reports/payments', reports.payments),
  doctor('GET', '/reports/outstanding', reports.outstanding),
  doctor('GET', '/reports/daily-revenue', reports.dailyRevenue),

  doctor('GET', '/settings', settings.showSettings),
  doctor('PUT', '/settings', settings.updateSettings),
  doctor('GET', '/staff', settings.staffIndex),
  doctor('POST', '/staff', settings.staffStore),
  doctor('PUT', '/staff/:staff', settings.staffUpdate),
  doctor('GET', '/audit-logs', settings.auditIndex),

  doctor('GET', '/working-hours', schedule.hoursIndex),
  doctor('PUT', '/working-hours', schedule.hoursUpdate),
  doctor('GET', '/blocked-times', schedule.blockedIndex),
  doctor('POST', '/blocked-times', schedule.blockedStore),
  doctor('DELETE', '/blocked-times/:blockedTime', schedule.blockedDestroy),

  assistant('GET', '/patients', assistantArea.index),
  assistant('POST', '/patients', assistantArea.store),
  assistant('GET', '/patients/:patient', assistantArea.show),
  assistant('PUT', '/patients/:patient', assistantArea.update),
  assistant('GET', '/visits/unpaid', assistantArea.unpaid),
  assistant('POST', '/visits/:visit/payments', assistantArea.storePayment),
  assistant('GET', '/appointments', schedule.staffSchedule),
  assistant('POST', '/appointments', schedule.staffBook),
  assistant('PATCH', '/appointments/:appointment/status', schedule.assistantStatus),
]
