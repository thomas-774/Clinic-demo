import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { DEMO_MODE } from '../api/client'
import { useAuth } from '../auth/useAuth'
import ErrorBoundary from '../components/ErrorBoundary'
import DemoBar from '../demo/ui/DemoBar'
import LanguageSwitcher from '../components/LanguageSwitcher'
import LogoutButton from './LogoutButton'
import SkipLink from './SkipLink'

/**
 * Staff areas (doctor, assistant): sidebar on wide screens; on phones it
 * opens from a Menu button. `links` is a list of { to, label, end? }.
 */
export default function SidebarLayout({ id, links }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <SkipLink />
      {DEMO_MODE && <DemoBar />}
      <div className="md:flex">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <span className="text-lg font-bold text-sky-700">{t('common.appName')}</span>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls={id}
            onClick={() => setMenuOpen((open) => !open)}
            className="ms-auto rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300"
          >
            {t('nav.menu')}
          </button>
        </header>

        <aside
          id={id}
          className={`${menuOpen ? 'flex' : 'hidden'} flex-col border-e border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0`}
        >
          <div className="hidden px-5 pt-6 pb-4 md:block">
            <span className="text-xl font-bold text-sky-700">{t('common.appName')}</span>
            <p className="mt-1 truncate text-sm text-slate-500">{user?.name}</p>
          </div>
          <nav aria-label={t('nav.main')} className="flex flex-col gap-1 px-3 py-3 md:py-0">
            {links.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-sky-50 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-3 md:mt-auto">
            <LanguageSwitcher />
            <LogoutButton className="ms-auto" />
          </div>
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none md:px-8">
          {/* A crashed page keeps the menu, so the user can go elsewhere. */}
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
