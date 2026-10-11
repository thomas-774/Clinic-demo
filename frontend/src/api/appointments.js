import client from './client'

const data = (res) => res.data.data

/** Patient: book { start_at } → the new appointment. */
export const bookAppointment = (startAt) => client.post('/patient/appointments', { start_at: startAt }).then(data)

/** Patient: { upcoming: [...], past: [...] }; each has can_cancel. */
export const getMyAppointments = () => client.get('/patient/appointments').then(data)

export const cancelMyAppointment = (id) => client.patch(`/patient/appointments/${id}/cancel`).then(data)

/** Doctor: every appointment from `from` to `to` (inclusive dates), by time, with patient name and phone. */
export const getSchedule = ({ from, to }) => client.get('/doctor/appointments', { params: { from, to } }).then(data)

/** Doctor: book { patient_id, start_at } on behalf of a patient. */
export const bookForPatient = (fields) => client.post('/doctor/appointments', fields).then(data)

/** Doctor: checked_in / completed / no_show / cancelled (§4.3). */
export const updateAppointmentStatus = (id, status) =>
  client.patch(`/doctor/appointments/${id}/status`, { status }).then(data)
