import client from './client'

const data = (res) => res.data.data

// The assistant (front desk) API, /assistant/* (Module I): contact info and money only.

/** Paginated list: resolves to { data: [...], meta: { current_page, last_page, total } }. */
export const listPatients = ({ search = '', page = 1 } = {}) =>
  client.get('/assistant/patients', { params: { search: search || undefined, page } }).then((res) => res.data)

/** { name, phone, email?, address, date_of_birth?, gender? } → the patient plus `initial_password` (this once). */
export const createPatient = (fields) => client.post('/assistant/patients', fields).then(data)

/** Contact info, next_appointment, visits (money only) and outstanding_balance. */
export const getPatient = (id) => client.get(`/assistant/patients/${id}`).then(data)

export const updatePatient = (id, fields) => client.put(`/assistant/patients/${id}`, fields).then(data)

/** Visits of `date` (today by default) that still owe money: "Waiting to pay". */
export const getUnpaidVisits = ({ date } = {}) => client.get('/assistant/visits/unpaid', { params: { date } }).then(data)

/** { amount, method, paid_at? } → the visit with its new balance. */
export const addPayment = (visitId, fields) => client.post(`/assistant/visits/${visitId}/payments`, fields).then(data)

/** The doctor's appointments from `from` to `to` (inclusive dates), with patient name and phone. */
export const getSchedule = ({ from, to }) => client.get('/assistant/appointments', { params: { from, to } }).then(data)

/** Book { patient_id, start_at } on behalf of a patient. */
export const bookForPatient = (fields) => client.post('/assistant/appointments', fields).then(data)

/** checked_in / no_show / cancelled. */
export const updateAppointmentStatus = (id, status) =>
  client.patch(`/assistant/appointments/${id}/status`, { status }).then(data)
