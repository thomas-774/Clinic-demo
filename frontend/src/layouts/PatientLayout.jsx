import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { DEMO_MODE } from '../api/client'
import { useAuth } from '../auth/useAuth'
import ErrorBoundary from '../components/ErrorBoundary'
import DemoBar from '../demo/ui/DemoBar'
import LanguageSwitcher from '../components/LanguageSwitcher'
import LogoutButton from './LogoutButton'
import SkipLink from './SkipLink'

const LINKS = [
  { to: '/patient', label: 'nav.home', end: true },
  { to: '/patient/book', label: 'nav.book' },
  { to: '/patient/appointments', label: 'nav.myAppointments' },
]

/** Patient area: top bar with links, language switcher and logout; works on phones. */
export default function PatientLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-slate-50">
      <SkipLink />
      {DEMO_MODE && <DemoBar />}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:py-3">
          <span className="text-lg font-bold text-sky-700">{t('common.appName')}</span>
          {/* Own full-width row on phones, inline from sm up. */}
          <nav
            aria-label={t('nav.main')}
            className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:ms-4 sm:w-auto"
          >
            {LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium ${
                    isActive ? 'bg-sky-50 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <span className="ms-auto hidden truncate text-sm text-slate-500 md:inline">{user?.name}</span>
          <LanguageSwitcher className="ms-auto md:ms-0" />
          <LogoutButton />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-4 focus:outline-none sm:py-6">
        {/* A crashed page keeps the menu, so the user can go elsewhere. */}
        <ErrorBoundary resetKey={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  )
}
