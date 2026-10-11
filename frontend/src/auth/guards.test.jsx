import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../api/auth'
import * as doctorPatientsApi from '../api/doctorPatients'
import { tokenStorage } from '../api/client'
import { expectPath, renderAppAt as renderAt } from '../test/renderApp'

const patient = { id: 2, name: 'Mona', role: 'patient', patient_id: 1 }
const doctor = { id: 1, name: 'Dr. Doctor', role: 'doctor' }
const assistant = { id: 3, name: 'Amal Saad', role: 'assistant' }

describe('route guards', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('sends a logged-out visitor to /login', async () => {
    renderAt('/doctor/patients')
    await expectPath('/login')
  })

  it('sends a patient who opens /doctor to /patient', async () => {
    tokenStorage.set('patient-token')
    vi.spyOn(authApi, 'me').mockResolvedValue(patient)

    renderAt('/doctor')

    expect(await screen.findByRole('link', { name: 'My appointments' })).toBeInTheDocument()
    await expectPath('/patient')
  })

  it('sends a doctor who opens /patient/book to /doctor', async () => {
    tokenStorage.set('doctor-token')
    vi.spyOn(authApi, 'me').mockResolvedValue(doctor)

    renderAt('/patient/book')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    await expectPath('/doctor')
  })

  it('sends an assistant to /assistant, away from the doctor and patient areas', async () => {
    tokenStorage.set('assistant-token')
    vi.spyOn(authApi, 'me').mockResolvedValue(assistant)

    renderAt('/doctor/reports')

    expect(await screen.findByRole('heading', { name: 'Today at the desk' })).toBeInTheDocument()
    await expectPath('/assistant')
    expect(screen.getByRole('link', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Patients' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('sends a patient or a doctor who opens /assistant to their own home', async () => {
    tokenStorage.set('doctor-token')
    vi.spyOn(authApi, 'me').mockResolvedValue(doctor)

    renderAt('/assistant/patients')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    await expectPath('/doctor')
  })

  it('lets each role open its own pages', async () => {
    tokenStorage.set('doctor-token')
    vi.spyOn(authApi, 'me').mockResolvedValue(doctor)

    const getPatient = vi.spyOn(doctorPatientsApi, 'getPatient').mockReturnValue(new Promise(() => {}))

    renderAt('/doctor/patients/12')

    await expectPath('/doctor/patients/12')
    await waitFor(() => expect(getPatient).toHaveBeenCalledWith(12))
  })

  it('sends a logged-in user away from /login to their home', async () => {
    tokenStorage.set('doctor-token')
    vi.spyOn(authApi, 'me').mockResolvedValue(doctor)

    renderAt('/login')

    await screen.findByRole('heading', { name: 'Dashboard' })
    await expectPath('/doctor')
  })

  it('shows a loader while checking the stored token', async () => {
    tokenStorage.set('slow-token')
    let resolve
    vi.spyOn(authApi, 'me').mockReturnValue(new Promise((r) => (resolve = r)))

    renderAt('/patient')

    expect(screen.getByRole('status')).toBeInTheDocument()
    resolve(patient)
    expect(await screen.findByRole('link', { name: 'My appointments' })).toBeInTheDocument()
  })

  it('offers a retry, not the login page, when the server cannot be reached at start (T7-03)', async () => {
    tokenStorage.set('good-token')
    const me = vi
      .spyOn(authApi, 'me')
      .mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
      .mockRejectedValueOnce(new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 503, data: {} }))
      .mockResolvedValue(patient)

    renderAt('/patient/appointments')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not reach the server. Please try again.')
    expect(tokenStorage.get()).toBe('good-token')

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    // Still down (503): the same screen again.
    await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
    await userEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    await expectPath('/patient/appointments')
  })

  it('treats a rejected stored token as logged out', async () => {
    tokenStorage.set('bad-token')
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('401'))

    renderAt('/patient')

    await expectPath('/login')
  })
})
