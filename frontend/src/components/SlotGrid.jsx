import { useTranslation } from 'react-i18next'
import { formatTime } from '../utils/format'

/**
 * One button per free slot (§7.3). `selected` is the chosen slot's start_at.
 * Shows a skeleton while loading and a message when the day has no slots.
 */
export default function SlotGrid({ slots = [], loading = false, selected = null, onSelect }) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div role="status" aria-label={t('common.loading')} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} data-testid="slot-skeleton" className="h-11 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
    )
  }

  if (!slots.length) {
    return <p className="rounded-xl bg-slate-50 p-4 text-center text-slate-600">{t('slots.empty')}</p>
  }

  return (
    <div role="group" aria-label={t('slots.label')} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {slots.map((slot) => {
        const isSelected = slot.start_at === selected
        return (
          <button
            key={slot.start_at}
            type="button"
            dir="ltr"
            aria-pressed={isSelected}
            onClick={() => onSelect?.(slot)}
            className={`h-11 rounded-lg text-sm font-semibold ring-1 transition ${
              isSelected
                ? 'bg-sky-700 text-white ring-sky-700'
                : 'bg-white text-sky-800 ring-sky-200 hover:bg-sky-50'
            }`}
          >
            {/* The chosen slot is marked by more than its colour (WCAG 1.4.1). */}
            {isSelected && <span aria-hidden="true">✓ </span>}
            {formatTime(slot.start_at)}
          </button>
        )
      })}
    </div>
  )
}
