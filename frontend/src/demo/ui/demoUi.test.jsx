import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenStorage } from '../../api/client'
import i18next from '../../i18n'
import { db, resetDemo } from '../../test/demo'
import { expectPath, renderAppAt } from '../../test/renderApp'

// The app's tests run with VITE_DEMO=false; these turn the demo UI on.
vi.mock('../../api/client', async (importOriginal) => ({ ...(await importOriginal()), DEMO_MODE: true }))

beforeEach(() => {
  resetDemo()
  tokenStorage.clear()
})

const bar = () => screen.getByText(/^Viewing as/).closest('div.border-b')

describe('login page', () => {
  it('has the three role buttons and the browser-only note', async () => {
    renderAppAt('/login')
    for (const name of ['Enter as Doctor', 'Enter as Patient', 'Enter as Assistant']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.getByText('Demo, data is saved only in this browser.')).toBeInTheDocument()
    // Normal login is still there.
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it.each([
    ['Enter as Doctor', '/doctor'],
    ['Enter as Patient', '/patient'],
    ['Enter as Assistant', '/assistant'],
  ])('%s logs in at once and opens that home page', async (name, home) => {
    renderAppAt('/login')
    await userEvent.click(await screen.findByRole('button', { name }))
    await expectPath(home)
    expect(tokenStorage.get()).toMatch(/^\d+\|/)
  })

  it('is in Arabic too', async () => {
    await i18next.changeLanguage('ar')
    renderAppAt('/login')
    expect(await screen.findByRole('button', { name: 'ادخل كطبيب' })).toBeInTheDocument()
    expect(screen.getByText('نسخة تجريبية، والبيانات محفوظة في هذا المتصفح فقط.')).toBeInTheDocument()
  })
})

describe('demo bar', () => {
  async function enterAsDoctor() {
    renderAppAt('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Enter as Doctor' }))
    await expectPath('/doctor')
    await screen.findByText('Viewing as Doctor')
  }

  it('switches role straight to the other role’s home', async () => {
    await enterAsDoctor()
    const group = within(bar()).getByRole('group', { name: 'Switch role:' })
    expect(within(group).queryByRole('button', { name: 'Doctor' })).toBeNull()

    await userEvent.click(within(group).getByRole('button', { name: 'Assistant' }))
    await expectPath('/assistant')
    expect(await screen.findByText('Viewing as Assistant')).toBeInTheDocument()

    await userEvent.click(within(bar()).getByRole('button', { name: 'Patient' }))
    await expectPath('/patient')
    expect(await screen.findByText('Viewing as Patient')).toBeInTheDocument()
  })

  it('resets the data after a confirm step and stays logged in', async () => {
    await enterAsDoctor()
    db.update('users', 1, { name: 'Changed by the visitor' })
    db.save()

    await userEvent.click(within(bar()).getByRole('button', { name: 'Reset demo data' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset the demo data?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(db.find('users', 1).name).toBe('Changed by the visitor')

    await userEvent.click(within(bar()).getByRole('button', { name: 'Reset demo data' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset' }))
    expect(await screen.findByText('The demo data is back to the start.')).toBeInTheDocument()
    expect(db.find('users', 1).name).toBe('Dr. Doctor')
    await expectPath('/doctor')
    await waitFor(() => expect(screen.getByText('Viewing as Doctor')).toBeInTheDocument())
  })
})
