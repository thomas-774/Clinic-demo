import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import Modal from './components/Modal'
import RouteChange from './components/RouteChange'
import Form from './components/form/Form'
import TextField from './components/form/TextField'
import i18next from './i18n'
import SkipLink from './layouts/SkipLink'
import { expectNoA11yViolations, tabTo } from './test/a11y'
import { ToastProvider } from './toast/ToastProvider'
import { useToast } from './toast/useToast'

// T11-12 (NFR-U.1): the shared accessibility pieces.

describe('expectNoA11yViolations', () => {
  it('fails on a button without a name and an input without a label', async () => {
    render(
      <main>
        <h1>Page</h1>
        <button type="button" />
        <input type="text" />
      </main>,
    )

    await expect(expectNoA11yViolations()).rejects.toThrow(/button-name \(critical\)[\s\S]*label \(critical\)/)
  })

  it('passes on labelled controls', async () => {
    render(
      <main>
        <h1>Page</h1>
        <button type="button">Save</button>
        <label htmlFor="n">Name</label>
        <input id="n" type="text" />
      </main>,
    )

    await expectNoA11yViolations()
  })
})

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal open={open} title="Edit" onClose={() => setOpen(false)}>
        <input aria-label="Name" />
        <button type="button">Save</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('keeps Tab inside, both ways, and gives the focus back on close', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    const opener = screen.getByRole('button', { name: 'Open' })

    await user.click(opener)
    const name = screen.getByLabelText('Name')
    expect(name).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.tab() // wraps to the × button, the first element in the dialog
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab({ shift: true }) // and back to the last
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes on a press on the backdrop, not inside the panel', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(screen.getByLabelText('Name'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('dialog').parentElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

function FormHarness({ check }) {
  const [errors, setErrors] = useState({})
  return (
    <Form
      onSubmit={async (event) => {
        event.preventDefault()
        setErrors(await check())
      }}
    >
      <TextField label="Name" error={errors.name} />
      <TextField label="Phone" error={errors.phone} />
      <button type="submit">Save</button>
    </Form>
  )
}

describe('Form', () => {
  it('moves the focus to the first invalid field after a submit (errors found at once)', async () => {
    const user = userEvent.setup()
    render(<FormHarness check={() => ({ phone: 'Enter a phone number.' })} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const phone = screen.getByLabelText('Phone')
    expect(phone).toHaveFocus()
    expect(phone).toHaveAttribute('aria-invalid', 'true')
    expect(phone).toHaveAccessibleDescription('Enter a phone number.')
  })

  it('does the same when the server answers later', async () => {
    const user = userEvent.setup()
    let answer
    render(<FormHarness check={() => new Promise((resolve) => (answer = resolve))} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()

    await act(async () => answer({ name: 'The name is required.', phone: 'Taken.' }))
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('leaves the focus alone when there is nothing to fix', async () => {
    const user = userEvent.setup()
    render(<FormHarness check={() => ({})} />)

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })
})

function ToastHarness() {
  const toast = useToast()
  return (
    <>
      <button type="button" onClick={() => toast.success('Saved.')}>
        Good
      </button>
      <button type="button" onClick={() => toast.error('Could not save.')}>
        Bad
      </button>
    </>
  )
}

describe('Toasts', () => {
  it('announce successes politely and errors at once, in regions that are always there', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    )
    const polite = document.querySelector('[aria-live="polite"]')
    const assertive = document.querySelector('[aria-live="assertive"]')
    expect(polite).toBeEmptyDOMElement()
    expect(assertive).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Good' }))
    await user.click(screen.getByRole('button', { name: 'Bad' }))

    expect(polite).toHaveTextContent('Saved.')
    expect(polite).not.toHaveTextContent('Could not save.')
    expect(assertive).toHaveTextContent('Could not save.')
  })
})

function Page({ title, children }) {
  return (
    <main id="main" tabIndex={-1}>
      <h1>{title}</h1>
      {children}
    </main>
  )
}

function renderRoutes(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SkipLink />
      <RouteChange />
      <nav>
        <Link to="/doctor/reports">Reports link</Link>
      </nav>
      <Routes>
        <Route path="/doctor/schedule" element={<Page title="Schedule" />} />
        <Route path="/doctor/reports" element={<Page title="Reports" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Skip link, page title and focus on navigation', () => {
  it('the first Tab reaches "Skip to content", which moves the focus to <main>', async () => {
    const user = userEvent.setup()
    renderRoutes('/doctor/schedule')

    await user.tab()
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('names the page in <title>, in the current language', async () => {
    renderRoutes('/doctor/schedule')
    expect(document.title).toBe('Schedule · Clinic')

    await act(() => i18next.changeLanguage('ar'))
    expect(document.title).toBe(`${i18next.t('pages.schedule')} · ${i18next.t('common.appName')}`)
    expect(document.title).not.toContain('Schedule')
  })

  it('moves the focus to the new page heading after a navigation, not on the first load', async () => {
    const user = userEvent.setup()
    renderRoutes('/doctor/schedule')
    expect(screen.getByRole('heading', { name: 'Schedule' })).not.toHaveFocus()

    await tabTo(user, screen.getByRole('link', { name: 'Reports link' }))
    await user.keyboard('{Enter}')

    const heading = await screen.findByRole('heading', { name: 'Reports' })
    await vi.waitFor(() => expect(heading).toHaveFocus())
    expect(document.title).toBe('Reports · Clinic')
  })
})
