import { AxiosError } from 'axios'
import i18next from 'i18next'
import { vi } from 'vitest'
import client, { setUnauthorizedHandler, tokenStorage } from './client'
import * as auth from './auth'

// Replace the network with a fake adapter that records each request.
function fakeServer(respond) {
  const requests = []
  client.defaults.adapter = async (config) => {
    requests.push(config)
    const { status = 200, data = {} } = respond(config)
    const response = { status, data, headers: {}, config, statusText: '' }
    if (status >= 400) {
      throw new AxiosError('error', String(status), config, null, response)
    }
    return response
  }
  return requests
}

describe('api client', () => {
  const unauthorized = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    unauthorized.mockReset()
    setUnauthorizedHandler(unauthorized)
  })

  it('sends the stored token as a Bearer header', async () => {
    const requests = fakeServer(() => ({ data: { data: { id: 1 } } }))
    tokenStorage.set('abc123')

    await auth.me()

    expect(requests[0].headers.Authorization).toBe('Bearer abc123')
  })

  it('sends no Authorization header when logged out', async () => {
    const requests = fakeServer(() => ({}))

    await client.get('/health')

    expect(requests[0].headers.Authorization).toBeUndefined()
  })

  it('sends the current language', async () => {
    const requests = fakeServer(() => ({}))

    await i18next.changeLanguage('ar')
    await client.get('/health')
    await i18next.changeLanguage('en')
    await client.get('/health')

    expect(requests[0].headers['Accept-Language']).toBe('ar')
    expect(requests[1].headers['Accept-Language']).toBe('en')
  })

  it('clears the token and calls the 401 handler when the token is rejected', async () => {
    fakeServer(() => ({ status: 401, data: { message: 'Unauthenticated.' } }))
    tokenStorage.set('expired')

    await expect(auth.me()).rejects.toThrow()

    expect(tokenStorage.get()).toBeNull()
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('leaves other errors alone', async () => {
    fakeServer(() => ({ status: 422, data: { errors: { login: ['Wrong'] } } }))
    tokenStorage.set('valid')

    await expect(auth.login({ login: 'x', password: 'y' })).rejects.toMatchObject({ response: { status: 422 } })

    expect(tokenStorage.get()).toBe('valid')
    expect(unauthorized).not.toHaveBeenCalled()
  })

  it('returns the data part of auth responses', async () => {
    const requests = fakeServer(() => ({ data: { data: { token: 't', user: { role: 'doctor' } }, message: 'Logged in.' } }))

    const result = await auth.login({ login: '01000000000', password: 'secret' })

    expect(result).toEqual({ token: 't', user: { role: 'doctor' } })
    expect(requests[0].url).toBe('/auth/login')
    expect(JSON.parse(requests[0].data)).toEqual({ login: '01000000000', password: 'secret' })
  })
})
