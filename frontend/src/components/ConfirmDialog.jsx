import { useTranslation } from 'react-i18next'
import Modal from './Modal'

/** "Are you sure?" dialog for destructive actions. */
export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, busy = false }) {
  const { t } = useTranslation()

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-slate-700">{message}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
