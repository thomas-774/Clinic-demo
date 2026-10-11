import client from './client'

/** Free slots for a date: { data: [{ start_at, end_at }], meta: { date, duration } } */
export const getSlots = (date) => client.get('/slots', { params: { date } }).then((res) => res.data)
