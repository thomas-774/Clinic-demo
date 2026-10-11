import client from './client'

const data = (res) => res.data.data

/** The patient's prescriptions, newest first: [{ id, issued_on, visit_id, notes, drug_names }] (FR-J.7). */
export const listPrescriptions = (patientId) => client.get(`/doctor/patients/${patientId}/prescriptions`).then(data)

/**
 * A full prescription with its lines, the patient's name and age, and the print header (FR-J.5).
 * The print page passes `{ purpose: 'print' }`, so the read is audited as printed (NFR-S.4).
 */
export const getPrescription = (id, { purpose } = {}) =>
  (purpose ? client.get(`/doctor/prescriptions/${id}`, { params: { purpose } }) : client.get(`/doctor/prescriptions/${id}`)).then(data)

/** { visit_id?, issued_on?, notes?, items: [{ drug_id?, drug_name?, instructions }] } (FR-J.4). */
export const createPrescription = (patientId, fields) =>
  client.post(`/doctor/patients/${patientId}/prescriptions`, fields).then(data)

/** Same body as create; the lines are replaced. */
export const updatePrescription = (id, fields) => client.put(`/doctor/prescriptions/${id}`, fields).then(data)

export const deletePrescription = (id) => client.delete(`/doctor/prescriptions/${id}`).then((res) => res.data)
