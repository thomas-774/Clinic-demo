import client from './client'

// Each call resolves to the `data` part of the API's { data, message } response.

/** @returns {Promise<{ token: string, user: object }>} */
export const register = (fields) => client.post('/auth/register', fields).then((res) => res.data.data)

/** `login` is a phone number or an email. */
export const login = ({ login, password }) =>
  client.post('/auth/login', { login, password }).then((res) => res.data.data)

export const logout = () => client.post('/auth/logout').then((res) => res.data)

/** @returns {Promise<{ id: number, name: string, role: 'patient' | 'doctor', patient_id?: number }>} */
export const me = () => client.get('/me').then((res) => res.data.data)
