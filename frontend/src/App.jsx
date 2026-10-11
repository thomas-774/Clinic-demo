import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './auth/AuthContext'
import { ToastProvider } from './toast/ToastProvider'

export default function App() {
  return (
    // Last resort, for a crash outside the routes (providers, router).
    <ErrorBoundary fullPage>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
