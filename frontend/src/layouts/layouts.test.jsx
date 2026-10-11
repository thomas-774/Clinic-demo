import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../api/auth'
import { tokenStorage } from '../api/client'
import { expectPath, renderAppAt } from '../test/renderApp'

function loginAs(user) {
  tokenStorage.set('token')
  vi.spyOn(authApi, 'me').mockResolvedValue(user)
}

describe('layouts', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('gives patients a top bar with Home, Book and My appointments', async () => {
    loginAs({ id: 2, name: 'Mona Ali', role: 'patient', patient_id: 1 })
    renderAppAt('/patient')

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    const links = within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])
    expect(links).toEqual([
      ['Home', '/patient'],
      ['Book', '/patient/book'],
      ['My appointments', '/patient/appointments'],
    ])
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves between patient pages', async () => {
    loginAs({ id: 2, name: 'Mona Ali', role: 'patient', patient_id: 1 })
    renderAppAt('/patient')

    await userEvent.click(await screen.findByRole('link', { name: 'Book' }))

    expect(await screen.findByRole('heading', { name: 'Book an appointment' })).toBeInTheDocument()
    await expectPath('/patient/book')
  })

  it('gives the doctor a sidebar with the five sections', async () => {
    loginAs({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
    renderAppAt('/doctor/schedule')

    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'Schedule',
      'Patients',
      'Reports',
      'Settings',
    ])
    expect(within(nav).getByRole('link', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens and closes the doctor menu on small screens', async () => {
    loginAs({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
    renderAppAt('/doctor')

    const menu = await screen.findByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByRole('link', { name: 'Patients' }))
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    ['patient', '/patient', { id: 2, name: 'Mona', role: 'patient', patient_id: 1 }],
    ['doctor', '/doctor', { id: 1, name: 'Dr. Doctor', role: 'doctor' }],
  ])('logs the %s out and returns to the login page', async (_role, path, user) => {
    loginAs(user)
    const logout = vi.spyOn(authApi, 'logout').mockResolvedValue({})
    renderAppAt(path)

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    await expectPath('/login')
    expect(logout).toHaveBeenCalledOnce()
    expect(tokenStorage.get()).toBeNull()
  })
})
