import { useTranslation } from 'react-i18next'

/**
 * Loading skeleton for a page or section: grey bars roughly where the
 * content will be. Screen readers hear "Loading…" once.
 */
export function Loading({ lines = 4 }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="space-y-3 py-4" data-testid="loading-skeleton">
      <span className="sr-only">{t('common.loading')}</span>
      <div aria-hidden="true" className="h-7 w-1/3 animate-pulse rounded-lg bg-slate-200" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} aria-hidden="true" className="h-14 animate-pulse rounded-xl bg-slate-200" />
      ))}
    </div>
  )
}

/** Error box with a retry button. */
export function LoadError({ onRetry }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
      <p>{t('common.loadError')}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 min-h-11 text-sm font-semibold underline">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
