import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth/useAuth'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../toast/useToast'
import { errorMessage } from '../../utils/apiErrors'
import { DEMO_ROLES } from '../accounts'
import { useDemoSession } from './useDemoSession'

/**
 * The slim bar on every logged-in page of the demo (D-09): the current role,
 * switching to another role, and resetting the data (after a confirm step).
 */
export default function DemoBar() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const toast = useToast()
  const { busy, enterAs, resetData } = useDemoSession()
  const [confirming, setConfirming] = useState(false)

  async function attempt(action, done) {
    try {
      await action()
      done?.()
    } catch (error) {
      toast.error(errorMessage(error, t('common.networkError')))
    }
  }

  async function reset() {
    await attempt(resetData, () => toast.success(t('demo.resetDone')))
    setConfirming(false)
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900 print:hidden">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5 text-sm">
        <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">{t('demo.badge')}</span>
        {role && (
          <span className="font-semibold">
            {/* Phones show the role alone, so the bar stays two rows high at 360 px. */}
            <span className="hidden sm:inline">{t('demo.viewingAs', { role: t(`demo.roles.${role}`) })}</span>
            <span className="sm:hidden">{t(`demo.roles.${role}`)}</span>
          </span>
        )}
        <div role="group" aria-labelledby="demo-switch" className="flex flex-wrap items-center gap-1 sm:ms-2">
          <span id="demo-switch" className="sr-only sm:not-sr-only sm:me-1">
            {t('demo.switchRole')}:
          </span>
          {DEMO_ROLES.filter((other) => other !== role).map((other) => (
            <button
              key={other}
              type="button"
              onClick={() => attempt(() => enterAs(other))}
              disabled={busy !== null}
              className="inline-flex min-h-9 items-center rounded-full bg-white px-3 font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-60"
            >
              {busy === other ? t('demo.entering') : t(`demo.roles.${other}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy !== null}
          className="ms-auto inline-flex min-h-9 items-center rounded-lg px-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {t('demo.reset')}
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t('demo.resetTitle')}
        message={t('demo.resetMessage')}
        confirmLabel={t('demo.resetConfirm')}
        busy={busy === 'reset'}
        onConfirm={reset}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
