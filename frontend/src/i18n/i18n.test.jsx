import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../api/auth'
import { tokenStorage } from '../api/client'
import { renderAppAt } from '../test/renderApp'
import i18next, { savedLanguage } from '.'
import ar from './locales/ar.json'
import en from './locales/en.json'

/** All keys of a nested translation object, e.g. "auth.login.title". */
function keysOf(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('defaults to Arabic when nothing is saved', () => {
    expect(savedLanguage()).toBe('ar')
  })

  it('opens the app in Arabic, right to left', async () => {
    await i18next.changeLanguage(savedLanguage())
    renderAppAt('/login')

    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
  })

  it('switches to English, flips the direction and remembers the choice', async () => {
    await i18next.changeLanguage('ar')
    renderAppAt('/login')

    await userEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    // What a reload reads back:
    expect(savedLanguage()).toBe('en')

    await userEvent.click(screen.getByRole('button', { name: 'العربية' }))
    expect(await screen.findByRole('heading', { name: 'تسجيل الدخول' })).toBeInTheDocument()
    expect(savedLanguage()).toBe('ar')
  })

  it('switches language from inside the doctor layout', async () => {
    tokenStorage.set('t')
    vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
    await i18next.changeLanguage('ar')
    renderAppAt('/doctor')

    expect(await screen.findByRole('link', { name: 'المرضى' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('link', { name: 'Patients' })).toBeInTheDocument()
  })

  it('has the same keys in Arabic and English', () => {
    expect(keysOf(ar).sort()).toEqual(keysOf(en).sort())
  })
})
