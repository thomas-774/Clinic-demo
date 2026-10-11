import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages, tabTo } from '../../test/a11y'

function apiError(status, data) {
  return new AxiosError('error', String(status), {}, null, { status, data, headers: {}, config: {}, statusText: '' })
}

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('logs the doctor in and opens the doctor area', async () => {
    const login = vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'doc-token', user: { id: 1, role: 'doctor' } })
    renderAppAt('/login')

    await userEvent.type(screen.getByLabelText('Phone or email'), '01000000000')
    await userEvent.type(screen.getByLabelText('Password'), 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await expectPath('/doctor')
    expect(login).toHaveBeenCalledWith({ login: '01000000000', password: 'password' })
    expect(tokenStorage.get()).toBe('doc-token')
  })

  it('returns a patient to the patient page they first asked for', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 't', user: { id: 2, role: 'patient' } })
    renderAppAt('/patient/appointments')
    await expectPath('/login')

    await userEvent.type(screen.getByLabelText('Phone or email'), '01012345678')
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await expectPath('/patient/appointments')
  })

  it('shows the server error under the field for wrong credentials', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(
      apiError(422, { message: 'x', errors: { login: ['These credentials do not match our records.'] } }),
    )
    renderAppAt('/login')

    await userEvent.type(screen.getByLabelText('Phone or email'), '01000000000')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('These credentials do not match our records.')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone or email')).toHaveAttribute('aria-invalid', 'true')
    await expectPath('/login')
  })

  it('shows the message of a non-field error such as the rate limit', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(apiError(429, { message: 'Too many login attempts.' }))
    renderAppAt('/login')

    await userEvent.type(screen.getByLabelText('Phone or email'), '01000000000')
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many login attempts.')
  })

  // T11-07 (ASVS 2.1.12): the password can be shown to check it, then hidden again.
  it('shows and hides the password', async () => {
    renderAppAt('/login')
    const password = screen.getByLabelText('Password')
    await userEvent.type(password, 'secret-pass')
    expect(password).toHaveAttribute('type', 'password')

    await userEvent.click(screen.getByRole('button', { name: 'Show Password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('secret-pass')

    await userEvent.click(screen.getByRole('button', { name: 'Hide Password' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})

describe('Register page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  async function fillForm() {
    await userEvent.type(screen.getByLabelText('Full name'), 'Mona Ali')
    await userEvent.type(screen.getByLabelText('Phone'), '01012345678')
    await userEvent.type(screen.getByLabelText('Address'), '12 Tahrir St')
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'secret-pass')
  }

  it('creates the account and opens the patient area', async () => {
    const register = vi
      .spyOn(authApi, 'register')
      .mockResolvedValue({ token: 'new-token', user: { id: 5, role: 'patient', patient_id: 3 } })
    renderAppAt('/register')

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await expectPath('/patient')
    expect(register).toHaveBeenCalledWith({
      name: 'Mona Ali',
      phone: '01012345678',
      email: '',
      address: '12 Tahrir St',
      password: 'secret-pass',
      password_confirmation: 'secret-pass',
    })
    expect(tokenStorage.get()).toBe('new-token')
  })

  it('shows each 422 field error under its field', async () => {
    vi.spyOn(authApi, 'register').mockRejectedValue(
      apiError(422, {
        message: 'x',
        errors: { phone: ['The phone has already been taken.'], password: ['The password field confirmation does not match.'] },
      }),
    )
    renderAppAt('/register')

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('The phone has already been taken.')).toBeInTheDocument()
    expect(screen.getByText('The password field confirmation does not match.')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Full name')).not.toHaveAttribute('aria-invalid')
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
// NFR-U.2 (T11-14): the phone shows the right keyboard and can fill the fields in.
describe('mobile keyboards and autofill', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('login: username / current-password, no auto-capitalising or correcting', () => {
    renderAppAt('/login')

    const login = screen.getByLabelText('Phone or email')
    expect(login).toHaveAttribute('autocomplete', 'username')
    expect(login).toHaveAttribute('autocapitalize', 'none')
    expect(login).toHaveAttribute('autocorrect', 'off')
    expect(login).toHaveAttribute('spellcheck', 'false')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('register: every field has its autocomplete token and the phone a phone keypad', () => {
    renderAppAt('/register')

    expect(screen.getByLabelText('Full name')).toHaveAttribute('autocomplete', 'name')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel')
    expect(screen.getByLabelText('Phone')).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText(/Email/)).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Address')).toHaveAttribute('autocomplete', 'street-address')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password')
  })
})

describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('login: has no serious or critical axe issues, in Arabic and in English', async () => {
    await expectNoA11yViolationsInBothLanguages(() => renderAppAt('/login'))
  })

  it('register: has no serious or critical axe issues, in Arabic and in English', async () => {
    await expectNoA11yViolationsInBothLanguages(() => renderAppAt('/register'))
  })

  it('logs in with the keyboard only, starting at "Skip to content"', async () => {
    const user = userEvent.setup()
    const login = vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'doc-token', user: { id: 1, role: 'doctor' } })
    renderAppAt('/login')

    await user.tab()
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
    await tabTo(user, screen.getByLabelText('Phone or email'))
    await user.keyboard('01000000000')
    await tabTo(user, screen.getByLabelText('Password'))
    await user.keyboard('password{Enter}')

    expect(login).toHaveBeenCalledWith({ login: '01000000000', password: 'password' })
    await expectPath('/doctor')
  })

  it('puts the focus on the field the server rejected', async () => {
    const user = userEvent.setup()
    vi.spyOn(authApi, 'login').mockRejectedValue(apiError(422, { message: 'x', errors: { login: ['These credentials do not match our records.'] } }))
    renderAppAt('/login')

    await tabTo(user, screen.getByLabelText('Password'))
    await user.keyboard('wrong{Enter}')

    const field = await screen.findByRole('textbox', { name: 'Phone or email' })
    await vi.waitFor(() => expect(field).toHaveFocus())
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })
})
