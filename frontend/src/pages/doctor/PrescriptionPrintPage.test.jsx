import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import * as authApi from '../../api/auth'
import { tokenStorage } from '../../api/client'
import * as drugsApi from '../../api/drugs'
import * as prescriptionsApi from '../../api/prescriptions'
import i18next from '../../i18n'
import { expectPath, renderAppAt } from '../../test/renderApp'
import { expectNoA11yViolationsInBothLanguages } from '../../test/a11y'

const PRESCRIPTION = {
  id: 55,
  patient_id: 7,
  visit_id: null,
  issued_on: '2026-10-05',
  notes: 'Soft food for 2 days',
  items: [
    { id: 1, position: 1, drug_id: 21, drug_name: 'Flagyl 500 mg', drug_form: 'tablets', instructions: '1 tablet every 8 hours for 5 days' },
    { id: 2, position: 2, drug_id: null, drug_name: 'Mouthwash X', drug_form: null, instructions: 'Rinse twice daily' },
  ],
  patient: { id: 7, name: 'Mona Ali', age: 36 },
  print: {
    doctor_name: 'Dr. Doctor',
    doctor_title: 'Dental surgeon',
    clinic_name: 'Smile Clinic',
    clinic_address: '1 Nile St, Cairo',
    clinic_phone: '0223456789',
    footer: 'Open Sat–Thu',
    paper: 'A5',
  },
}

function renderPrint(prescription = PRESCRIPTION) {
  tokenStorage.set('t')
  vi.spyOn(authApi, 'me').mockResolvedValue({ id: 1, name: 'Dr. Doctor', role: 'doctor' })
  vi.spyOn(prescriptionsApi, 'getPrescription').mockResolvedValue(prescription)
  vi.spyOn(drugsApi, 'getDrug')
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  renderAppAt('/doctor/prescriptions/55/print')
  return print
}

describe('PrescriptionPrintPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the header, patient, date, every line and the notes', async () => {
    renderPrint()

    const sheet = await screen.findByRole('article', { name: 'Prescription' })
    expect(within(sheet).getByRole('heading', { name: 'Smile Clinic' })).toBeInTheDocument()
    expect(sheet).toHaveTextContent('Dr. Doctor')
    expect(sheet).toHaveTextContent('Dental surgeon')
    expect(sheet).toHaveTextContent('1 Nile St, Cairo · 0223456789')
    expect(sheet).toHaveTextContent('Patient: Mona Ali')
    expect(sheet).toHaveTextContent('Age: 36')
    expect(sheet).toHaveTextContent('Date: 5 Oct 2026')
    expect(sheet).toHaveTextContent('Rx')

    const lines = within(sheet).getAllByRole('listitem')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveTextContent('1.Flagyl 500 mg — tablets1 tablet every 8 hours for 5 days')
    expect(lines[1]).toHaveTextContent('2.Mouthwash XRinse twice daily')

    expect(sheet).toHaveTextContent('Soft food for 2 days')
    expect(sheet).toHaveTextContent('Signature')
    expect(sheet).toHaveTextContent('Open Sat–Thu')
    expect(sheet).toHaveAttribute('data-paper', 'A5')
    expect(sheet).toHaveClass('rx-paper-a5')
  })

  it('asks for the prescription as a print, so the server logs it as printed (NFR-S.4)', async () => {
    renderPrint()

    await screen.findByRole('article', { name: 'Prescription' })
    expect(prescriptionsApi.getPrescription).toHaveBeenCalledWith('55', { purpose: 'print' })
  })

  it('has no app chrome and never shows warnings or ingredients (RX-4)', async () => {
    renderPrint({
      ...PRESCRIPTION,
      // Even if drug notes ever came along, the page must not print them.
      items: PRESCRIPTION.items.map((item) => ({ ...item, warnings: 'Never with alcohol', active_ingredients: [{ name: 'metronidazole' }] })),
    })

    await screen.findByRole('article', { name: 'Prescription' })
    expect(screen.queryByText(/Never with alcohol/)).not.toBeInTheDocument()
    expect(screen.queryByText(/metronidazole/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Warnings|Active ingredients|Suggested dose|EGP/)).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    expect(drugsApi.getDrug).not.toHaveBeenCalled()
  })

  it('opens the print dialog once on load; "Print again" prints again', async () => {
    const print = renderPrint()

    await screen.findByRole('article', { name: 'Prescription' })
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(print).toHaveBeenCalledTimes(1)

    const again = screen.getByRole('button', { name: 'Print again' })
    expect(again.parentElement).toHaveClass('print:hidden')
    await userEvent.click(again)
    expect(print).toHaveBeenCalledTimes(2)
  })

  it('puts the page on the paper size while open; "Back to patient" goes to the patient page', async () => {
    renderPrint()

    await screen.findByRole('article', { name: 'Prescription' })
    // The whole document is on the A5 page while printing, so no blank second sheet comes out.
    expect(document.documentElement).toHaveClass('rx-paper-a5')

    await userEvent.click(screen.getByRole('link', { name: '← Back to patient' }))
    await expectPath('/doctor/patients/7')
    expect(document.documentElement).not.toHaveClass('rx-paper-a5')
  })

  it('uses the A4 page when the settings say so, and leaves out empty header parts', async () => {
    renderPrint({
      ...PRESCRIPTION,
      notes: null,
      patient: { id: 7, name: 'Mona Ali', age: null },
      print: { ...PRESCRIPTION.print, clinic_name: null, clinic_address: null, clinic_phone: null, footer: null, paper: 'A4' },
    })

    const sheet = await screen.findByRole('article', { name: 'Prescription' })
    expect(sheet).toHaveClass('rx-paper-a4')
    expect(document.documentElement).toHaveClass('rx-paper-a4')
    expect(within(sheet).queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(sheet).not.toHaveTextContent('Age')
    expect(sheet).not.toHaveTextContent('Notes')
    expect(sheet.querySelector('footer')).toBeNull()
  })

  it('prints right-to-left in Arabic, with drug names and instructions in dir="auto"', async () => {
    await i18next.changeLanguage('ar')
    renderPrint()

    const sheet = await screen.findByRole('article', { name: 'الروشتة' })
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(sheet).toHaveTextContent('المريض: Mona Ali')
    expect(sheet).toHaveTextContent('التوقيع')
    expect(within(sheet).getByText('Flagyl 500 mg')).toHaveAttribute('dir', 'auto')
    expect(within(sheet).getByText('Rinse twice daily')).toHaveAttribute('dir', 'auto')
  })
})

// NFR-U.1 (T11-12): axe on the loaded page in both languages.
describe('accessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe issues, in Arabic and in English', async () => {
    await expectNoA11yViolationsInBothLanguages(() => renderPrint())
  })
})
