import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { vi } from 'vitest'
import * as authApi from '../api/auth'
import client, { tokenStorage } from '../api/client'
import { renderAppAt } from '../test/renderApp'

/*
 * T7-03: every page, with the API offline and with the API never answering.
 * Offline, each page says it could not load and offers Retry, which asks
 * the server again; it never crashes or stays blank. Waiting, each page
 * shows its loading skeleton.
 */

const USERS = {
  patient: { id: 5, name: 'Mona Ali', role: 'patient', patient_id: 7 },
  doctor: { id: 1, name: 'Dr. Doctor', role: 'doctor' },
  assistant: { id: 3, name: 'Amal Saad', role: 'assistant' },
}

const PAGES = [
  ['patient', '/patient'],
  ['patient', '/patient/book'],
  ['patient', '/patient/appointments'],
  ['doctor', '/doctor'],
  ['doctor', '/doctor/schedule'],
  ['doctor', '/doctor/patients'],
  ['doctor', '/doctor/patients/7'],
  ['doctor', '/doctor/visits/new?appointment=40'],
  ['doctor', '/doctor/visits/new?patient=7'],
  ['doctor', '/doctor/patients/7/prescriptions/new'],
  ['doctor', '/doctor/prescriptions/3/edit'],
  ['doctor', '/doctor/prescriptions/3/print'],
  ['doctor', '/doctor/settings'],
  ['doctor', '/doctor/reports'],
  ['assistant', '/assistant'],
  ['assistant', '/assistant/patients'],
  ['assistant', '/assistant/patients/7'],
  ['assistant', '/assistant/schedule'],
]

const originalAdapter = client.defaults.adapter
let requests

function renderAs(role, path, adapter) {
  requests = 0
  client.defaults.adapter = (config) => {
    requests += 1
    return adapter(config)
  }
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue(USERS[role])
  return renderAppAt(path)
}

const offline = (config) => Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))
const neverAnswers = () => new Promise(() => {})

describe('every page', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    client.defaults.adapter = originalAdapter
  })

  it.each(PAGES)('%s %s: offline, says it could not load and retries', async (role, path) => {
    renderAs(role, path, offline)

    // A page with several sections (the dashboard) shows one error box per section.
    const alerts = await screen.findAllByRole('alert', {}, { timeout: 3000 })
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    const retry = alerts.map((alert) => within(alert).queryByRole('button', { name: 'Retry' })).find(Boolean)
    expect(retry).toBeTruthy()

    const before = requests
    await userEvent.click(retry)
    await vi.waitFor(() => expect(requests).toBeGreaterThan(before))
  })

  it.each(PAGES)('%s %s: while waiting, shows the loading skeleton', async (role, path) => {
    renderAs(role, path, neverAnswers)

    // The page's own skeleton, not the app's loader shown while the page's code downloads.
    await vi.waitFor(() => {
      const loading = screen.queryAllByRole('status').filter((el) => el.dataset.testid !== 'full-page-loader')
      expect(loading.some((el) => el.textContent.includes('Loading…') || el.getAttribute('aria-label') === 'Loading…')).toBe(true)
    })
    expect(screen.queryByTestId('full-page-loader')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
