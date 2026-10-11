import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastContext } from './useToast'

const DURATION_MS = 4000
let nextId = 1

function Toast({ toast, onDismiss, closeLabel }) {
  return (
    <div
      className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
        toast.type === 'error' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-green-50 text-green-800 ring-green-200'
      }`}
    >
      <span className="flex-1">{toast.text}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label={closeLabel} className="leading-none opacity-70 hover:opacity-100">
        ×
      </button>
    </div>
  )
}

/** Small notifications in the bottom corner; they disappear after a few seconds. */
export function ToastProvider({ children }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback(
    (type, text) => {
      const id = nextId++
      setToasts((current) => [...current, { id, type, text }])
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({ success: (text) => show('success', text), error: (text) => show('error', text) }),
    [show],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Two live regions, always present so screen readers notice what is added (NFR-U.1):
          successes wait their turn, errors interrupt. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pe-6 print:hidden">
        <div aria-live="polite" data-toasts="success" className="flex flex-col items-center gap-2 sm:items-end">
          {toasts.filter((toast) => toast.type !== 'error').map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} closeLabel={t('common.close')} />
          ))}
        </div>
        <div aria-live="assertive" data-toasts="error" className="flex flex-col items-center gap-2 sm:items-end">
          {toasts.filter((toast) => toast.type === 'error').map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} closeLabel={t('common.close')} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
