import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

function subscribe(onChange) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * A strip at the top of every page while the device is offline. Pages keep
 * what they already loaded; React Query refetches when the connection is back.
 */
export default function OfflineBanner() {
  const { t } = useTranslation()
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)

  return (
    <div aria-live="polite">
      {!online && <p className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">{t('common.offline')}</p>}
    </div>
  )
}
