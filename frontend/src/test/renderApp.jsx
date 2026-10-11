import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AppRoutes from '../AppRoutes'
import { AuthProvider } from '../auth/AuthContext'
import { ToastProvider } from '../toast/ToastProvider'

function CurrentPath() {
  return <span data-testid="path">{useLocation().pathname}</span>
}

/** Renders the whole app (providers + routes) at `path`. */
export function renderAppAt(path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
            <CurrentPath />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Waits until the router is at exactly `path`. */
export async function expectPath(path) {
  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe(path))
}
