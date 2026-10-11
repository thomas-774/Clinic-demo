import i18next from 'i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import * as authApi from '../api/auth'
import client, { tokenStorage } from '../api/client'
import { getHealth } from '../api/health'
import { apiPath } from './adapter'
import * as db from './db'
import { handle } from './router'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './seed'
import { loginAs, resetDemo } from '../test/demo'

beforeEach(resetDemo)

describe('adapter', () => {
  it('finds the API path with or without a base URL', () => {
    expect(apiPath('/doctor/patients/5', 'http://localhost:8000/api/v1')).toEqual({ path: '/doctor/patients/5', query: {} })
    expect(apiPath('/slots?date=2026-10-12', undefined)).toEqual({ path: '/slots', query: { date: '2026-10-12' } })
    expect(apiPath('/api/v1/me', '')).toEqual({ path: '/me', query: {} })
  })
})

describe('auth', () => {
  it.each(['doctor', 'assistant', 'patient'])('logs in as the %s and /me returns that user', async (role) => {
    const user = await loginAs(role)
    expect(user.role).toBe(role)
    const me = await authApi.me()
    expect(me).toEqual(user)
    if (role === 'patient') expect(me.patient_id).toBe(1)
    else expect(me).not.toHaveProperty('patient_id')
  })

  it('accepts a phone typed with spaces and dashes', async () => {
    const { user } = await authApi.login({ login: ' 0100-000 0000 ', password: DEMO_PASSWORD })
    expect(user.role).toBe('doctor')
  })

  it('refuses a wrong password with a translated 422 on login', async () => {
    await i18next.changeLanguage('ar')
    const error = await authApi.login({ login: DEMO_ACCOUNTS.doctor, password: 'nope' }).catch((e) => e)
    expect(error.response.status).toBe(422)
    expect(error.response.data.errors.login[0]).toBe('بيانات الاعتماد هذه غير متطابقة مع البيانات المسجلة لدينا.')
    expect(error.response.data.message).toBe(error.response.data.errors.login[0])
  })

  it('summarises several validation errors like Laravel', async () => {
    const error = await authApi.login({ login: '', password: '' }).catch((e) => e)
    expect(error.response.data).toEqual({
      message: 'The phone or email field is required. (and 1 more error)',
      errors: { login: ['The phone or email field is required.'], password: ['The password field is required.'] },
    })
  })

  it('registers a patient, who can then log in', async () => {
    const { user, token } = await authApi.register({
      name: 'New Patient',
      phone: '0123 456 7890',
      email: '',
      password: 'secret123',
      password_confirmation: 'secret123',
      address: 'Cairo',
    })
    expect(token).toMatch(/^\d+\|\w{40}$/)
    expect(user).toMatchObject({ name: 'New Patient', phone: '01234567890', email: null, role: 'patient' })
    expect(db.find('patients', user.patient_id).address).toBe('Cairo')
    expect((await authApi.login({ login: '01234567890', password: 'secret123' })).user.id).toBe(user.id)
  })

  it('refuses a taken phone and a short, unconfirmed password', async () => {
    const error = await authApi
      .register({ name: 'X', phone: DEMO_ACCOUNTS.doctor, password: 'short', password_confirmation: 'other', address: 'Giza' })
      .catch((e) => e)
    expect(error.response.status).toBe(422)
    expect(error.response.data.errors.phone).toEqual(['The phone has already been taken.'])
    expect(error.response.data.errors.password).toEqual([
      'The password field confirmation does not match.',
      'The password field must be at least 8 characters.',
    ])
    // Nothing was written.
    expect(db.where('users', { name: 'X' })).toHaveLength(0)
  })

  it('logout revokes the token: the next /me is 401 and clears it', async () => {
    await loginAs('doctor')
    await authApi.logout()
    await expect(authApi.me()).rejects.toMatchObject({ response: { status: 401, data: { message: 'Unauthenticated.' } } })
    expect(tokenStorage.get()).toBeNull()
  })

  it('a deactivated account cannot log in and its token stops working', async () => {
    await loginAs('assistant')
    db.update('users', 2, { is_active: false })
    await expect(authApi.me()).rejects.toMatchObject({ response: { status: 401 } })
    await expect(authApi.login({ login: DEMO_ACCOUNTS.assistant, password: DEMO_PASSWORD })).rejects.toMatchObject({ response: { status: 422 } })
  })
})

describe('router', () => {
  it('/health is public and says it is the demo', async () => {
    tokenStorage.clear()
    const health = await getHealth()
    expect(health).toMatchObject({ status: 'ok', demo: true })
    expect(health.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+0[23]:00$/)
  })

  it('answers 404 for an unknown path and 401 without a token', async () => {
    tokenStorage.clear()
    await expect(client.get('/nowhere')).rejects.toMatchObject({ response: { status: 404, data: { message: 'Not Found' } } })
    await expect(client.get('/me')).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('answers 405 for a known path with the wrong method, in Arabic by default', () => {
    expect(handle({ method: 'DELETE', path: '/me' })).toMatchObject({ status: 405, data: { message: 'الطريقة غير مسموحة' } })
    expect(handle({ method: 'GET', path: '/nowhere' }).data.message).toBe('غير متوفر')
  })
})
