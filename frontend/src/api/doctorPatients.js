import client from './client'

const data = (res) => res.data.data

/** Paginated list: resolves to { data: [...], meta: { current_page, last_page, total } }. */
export const listPatients = ({ search = '', page = 1 } = {}) =>
  client.get('/doctor/patients', { params: { search: search || undefined, page } }).then((res) => res.data)

/** Resolves to the patient plus `initial_password` (returned only this once). */
export const createPatient = (fields) => client.post('/doctor/patients', fields).then(data)

export const getPatient = (id) => client.get(`/doctor/patients/${id}`).then(data)

export const updatePatient = (id, fields) => client.put(`/doctor/patients/${id}`, fields).then(data)

export const addHistoryEntry = (patientId, fields) =>
  client.post(`/doctor/patients/${patientId}/history`, fields).then(data)

export const updateHistoryEntry = (patientId, entryId, fields) =>
  client.put(`/doctor/patients/${patientId}/history/${entryId}`, fields).then(data)

export const deleteHistoryEntry = (patientId, entryId) =>
  client.delete(`/doctor/patients/${patientId}/history/${entryId}`).then((res) => res.data)
