import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../../../api/auth'
import { tokenStorage } from '../../../api/client'
import * as settingsApi from '../../../api/settings'
import { renderAppAt } from '../../../test/renderApp'

const SETTINGS = {
  slot_duration_minutes: 45,
  booking_window_days: 30,
  cancel_cutoff_hours: 2,
  clinic_name: 'Smile Clinic',
  doctor_title: null,
  clinic_address: '1 Nile St',
  clinic_phone: null,
  prescription_footer: null,
  prescription_paper: 'A5',
}

function fakeServer() {
  vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(SETTINGS)
  vi.spyOn(settingsApi, 'getWorkingHours').mockResolvedValue([])
  return vi.spyOn(settingsApi, 'updateSettings').mockImplementation(async (fields) => ({ ...SETTINGS, ...fields }))
}

function renderTab() {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Mona Hassan', role: 'doctor' })
  return renderAppAt('/doctor/settings?tab=prescription')
}

const preview = () => within(screen.getByRole('region', { name: 'Preview' })).getByRole('article', { name: 'Prescription' })

describe('Settings → Prescription', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows the saved header in the form and a sample prescription in the preview', async () => {
    fakeServer()
    renderTab()

    expect(await screen.findByLabelText('Clinic name')).toHaveValue('Smile Clinic')
    expect(screen.getByLabelText('Address')).toHaveValue('1 Nile St')
    expect(screen.getByLabelText('A5 (half page)')).toBeChecked()

    expect(within(preview()).getByRole('heading', { name: 'Smile Clinic' })).toBeInTheDocument()
    expect(preview()).toHaveTextContent('Dr. Mona Hassan')
    expect(preview()).toHaveTextContent('Patient: Sample patient')
    expect(preview()).toHaveTextContent('Augmentin 1 g — tablets')
    expect(preview()).toHaveClass('rx-paper-a5')
  })

  it('the preview updates while typing, and the form saves', async () => {
    const update = fakeServer()
    renderTab()

    const title = await screen.findByLabelText("Doctor's title")
    await userEvent.type(title, 'Dental surgeon')
    expect(preview()).toHaveTextContent('Dental surgeon')

    await userEvent.clear(screen.getByLabelText('Clinic name'))
    await userEvent.type(screen.getByLabelText('Clinic name'), 'Bright Teeth')
    expect(within(preview()).getByRole('heading', { name: 'Bright Teeth' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Phone'), '0223456789')
    await userEvent.type(screen.getByLabelText('Footer'), 'Open Sat–Thu')
    expect(preview()).toHaveTextContent('Open Sat–Thu')

    await userEvent.click(screen.getByLabelText('A4 (full page)'))
    expect(preview()).toHaveClass('rx-paper-a4')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(update).toHaveBeenCalledWith({
      clinic_name: 'Bright Teeth',
      doctor_title: 'Dental surgeon',
      clinic_address: '1 Nile St',
      clinic_phone: '0223456789',
      prescription_footer: 'Open Sat–Thu',
      prescription_paper: 'A4',
    })
    expect(await screen.findByText('Prescription settings saved.')).toBeInTheDocument()
  })

  it('sends empty fields as null', async () => {
    const update = fakeServer()
    renderTab()

    await userEvent.clear(await screen.findByLabelText('Address'))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(update.mock.calls[0][0]).toMatchObject({ clinic_address: null, doctor_title: null, prescription_paper: 'A5' })
  })
})
