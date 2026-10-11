import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { printHtml } from '../../utils/download'
import { loginAs, resetDemo } from '../../test/demo'
import { renderAppAt } from '../../test/renderApp'

// The app's tests run with VITE_DEMO=false; these turn the demo on.
vi.mock('../../api/client', async (importOriginal) => ({ ...(await importOriginal()), DEMO_MODE: true }))

beforeEach(async () => {
  resetDemo()
  await loginAs('doctor')
  document.querySelectorAll('iframe').forEach((frame) => frame.remove())
})

describe('visit file in the demo', () => {
  it('offers PDF only, and opens the print view of the report', async () => {
    renderAppAt('/doctor/patients/1')
    const visits = await screen.findByRole('heading', { name: /visits/i })
    const section = visits.closest('section') ?? document.body
    const pdf = (await within(section).findAllByRole('button', { name: /as PDF$/ }))[0]
    expect(within(section).queryByRole('button', { name: /as Word$/ })).toBeNull()

    await userEvent.click(pdf)
    expect(await screen.findByText('The print view is open: choose “Save as PDF” to keep the file.')).toBeInTheDocument()
    const frame = document.querySelector('iframe[aria-hidden="true"]')
    expect(frame.contentDocument.title).toMatch(/^Visit report — /)
  })

  it('printHtml writes the page into a hidden frame', () => {
    const frame = printHtml('<!DOCTYPE html><html><head><title>Report</title></head><body>Hello</body></html>')
    expect(frame.getAttribute('aria-hidden')).toBe('true')
    expect(frame.contentDocument.body.textContent).toBe('Hello')
  })
})
