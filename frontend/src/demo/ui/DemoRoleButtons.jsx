import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '../../utils/apiErrors'
import { DEMO_ROLES } from '../accounts'
import { useDemoSession } from './useDemoSession'

/** Login page: one click into the demo as each role (D-09). */
export default function DemoRoleButtons() {
  const { t } = useTranslation()
  const { busy, enterAs } = useDemoSession()
  const [error, setError] = useState('')

  async function enter(role) {
    setError('')
    try {
      await enterAs(role)
    } catch (failure) {
      setError(errorMessage(failure, t('common.networkError')))
    }
  }

  return (
    <section aria-labelledby="demo-roles" className="mb-6">
      <h2 id="demo-roles" className="text-sm font-semibold text-slate-700">
        {t('demo.tryAs')}
      </h2>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-2 grid gap-2">
        {DEMO_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => enter(role)}
            disabled={busy !== null}
            className="min-h-12 w-full rounded-lg bg-sky-50 px-4 py-3 text-base font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100 disabled:opacity-60"
          >
            {busy === role ? t('demo.entering') : t(`demo.enterAs.${role}`)}
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('demo.note')}</p>
      <p className="mt-5 flex items-center gap-3 text-sm text-slate-600 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
        {t('demo.orLogIn')}
      </p>
    </section>
  )
}
