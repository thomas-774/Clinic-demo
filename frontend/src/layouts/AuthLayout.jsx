import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import SkipLink from './SkipLink'

/** Centered card used by the Login and Register pages. */
export default function AuthLayout({ title, children, footer }) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-4 sm:items-center sm:py-10">
      <SkipLink />
      <div className="w-full max-w-md">
        <header className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
          <span className="text-lg font-bold text-sky-700">{t('common.appName')}</span>
          <LanguageSwitcher />
        </header>
        <main id="main" tabIndex={-1} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 focus:outline-none sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <div className="mt-5 sm:mt-6">{children}</div>
        </main>
        {footer && <div className="mt-4 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </div>
  )
}
