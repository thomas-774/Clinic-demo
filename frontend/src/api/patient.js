import client from './client'

/** The logged-in patient's own page (GET /patient/profile). */
export const getProfile = () => client.get('/patient/profile').then((res) => res.data.data)

/** Only phone and address can be changed by the patient. */
export const updateProfile = ({ phone, address }) =>
  client.patch('/patient/profile', { phone, address }).then((res) => res.data.data)
