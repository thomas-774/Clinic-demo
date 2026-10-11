import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../../../api/auth'
import { tokenStorage } from '../../../api/client'
import * as api from '../../../api/settings'
import { renderAppAt } from '../../../test/renderApp'

/** /doctor/staff like the API: create returns the password once, PUT changes the row. */
function fakeServer(initial = []) {
  let staff = [...initial]
  vi.spyOn(api, 'getSettings').mockResolvedValue({ slot_duration_minutes: 45, booking_window_days: 30, cancel_cutoff_hours: 2 })
  vi.spyOn(api, 'getWorkingHours').mockResolvedValue([0, 1, 2, 3, 4, 5, 6].map((day) => ({ day_of_week: day, ranges: [] })))
  vi.spyOn(api, 'getBlockedTimes').mockResolvedValue([])
  vi.spyOn(api, 'getStaff').mockImplementation(async () => staff)
  return {
    create: vi.spyOn(api, 'createStaff').mockImplementation(async (fields) => {
      const account = { id: 50, role: 'assistant', is_active: true, ...fields }
      staff = [...staff, account]
      return { ...account, initial_password: 'k7m2p9qa' }
    }),
    update: vi.spyOn(api, 'updateStaff').mockImplementation(async (id, fields) => {
      const { reset_password: reset, ...rest } = fields
      staff = staff.map((row) => (row.id === id ? { ...row, ...rest } : row))
      const row = staff.find((r) => r.id === id)
      return reset ? { ...row, initial_password: 'n3w4p5ss' } : row
    }),
  }
}

function renderSettings() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  return renderAppAt('/doctor/settings')
}

const AMAL = { id: 7, name: 'Amal Saad', phone: '01022223333', email: null, role: 'assistant', is_active: true }

describe('Settings: staff', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('adds an assistant and shows the password once', async () => {
    const server = fakeServer()
    renderSettings()

    expect(await screen.findByText('No assistants yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add assistant' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add assistant' })
    await userEvent.type(within(dialog).getByLabelText(/Full name/), 'Amal Saad')
    await userEvent.type(within(dialog).getByLabelText(/Phone/), '01022223333')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add assistant' }))

    expect(server.create).toHaveBeenCalledWith({ name: 'Amal Saad', phone: '01022223333', email: null })
    expect(await screen.findByRole('dialog', { name: 'Assistant added' })).toBeInTheDocument()
    expect(screen.getByTestId('staff-password')).toHaveTextContent('k7m2p9qa')

    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByTestId('staff-password')).not.toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Staff' })
    expect(within(list).getByText('Amal Saad')).toBeInTheDocument()
    expect(within(list).getByText('Active')).toBeInTheDocument()
  })

  it('deactivates after asking, then activates again', async () => {
    const server = fakeServer([AMAL])
    renderSettings()

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Amal Saad' }))
    const dialog = screen.getByRole('dialog', { name: 'Deactivate this assistant?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, deactivate' }))

    expect(server.update).toHaveBeenCalledWith(7, { is_active: false })
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
    expect(screen.getByText('Amal Saad was deactivated and logged out.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Activate Amal Saad' }))
    expect(server.update).toHaveBeenLastCalledWith(7, { is_active: true })
    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('resets the password and shows the new one once', async () => {
    const server = fakeServer([AMAL])
    renderSettings()

    await userEvent.click(await screen.findByRole('button', { name: 'Reset password of Amal Saad' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, reset' }))

    expect(server.update).toHaveBeenCalledWith(7, { reset_password: true })
    expect(await screen.findByTestId('staff-password')).toHaveTextContent('n3w4p5ss')
  })

  it('edits name and phone', async () => {
    const server = fakeServer([AMAL])
    renderSettings()

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Amal Saad' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit assistant' })
    const name = within(dialog).getByLabelText(/Full name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Amal S. Saad')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(server.update).toHaveBeenCalledWith(7, { name: 'Amal S. Saad', phone: '01022223333', email: null })
    expect(await screen.findByText('Amal S. Saad')).toBeInTheDocument()
  })
})
