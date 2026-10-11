import client from './client'

export const getHealth = () => client.get('/health').then((res) => res.data)
