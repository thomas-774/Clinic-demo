import { useTranslation } from 'react-i18next'
import { previewSlots } from '../../../utils/previewSlots'

/** Chips for the slots the current (unsaved) hours and duration would give. */
export default function SlotPreview({ dayName, ranges, duration }) {
  const { t } = useTranslation()
  if (!ranges.length) return null

  const slots = previewSlots(ranges, duration)

  return (
    <div role="group" aria-label={t('settings.previewFor', { day: dayName })} className="rounded-lg bg-sky-50/60 p-2">
      <p className="mb-1 text-xs text-slate-600">{t('settings.previewCount', { count: slots.length })}</p>
      {slots.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {/* Keyed by position: while editing, overlapping ranges can repeat a time. */}
          {slots.map((start, index) => (
            <span key={index} dir="ltr" data-testid="preview-slot" className="rounded-md bg-white px-2 py-0.5 text-xs text-sky-800 ring-1 ring-sky-200">
              {start}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
