import { useTranslation } from 'react-i18next'
import { formatDate } from '../utils/format'

/**
 * Medical history entries.
 * - mode "simple": the patient's view — date, title, short description.
 * - mode "detailed": the doctor's view — adds type, full details, a "private"
 *   badge and per-entry actions (`renderActions(entry)`).
 */
export default function HistoryList({ entries, mode = 'simple', renderActions }) {
  const { t } = useTranslation()

  if (!entries.length) {
    return <p className="text-sm text-slate-500">{t('history.empty')}</p>
  }

  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((entry) => (
        <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <time dateTime={entry.recorded_on} className="text-xs text-slate-500">
              {formatDate(entry.recorded_on)}
            </time>
            {mode === 'detailed' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {t(`history.types.${entry.type}`)}
              </span>
            )}
            {mode === 'detailed' && !entry.patient_visible && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {t('history.private')}
              </span>
            )}
            {renderActions && <div className="ms-auto flex gap-1">{renderActions(entry)}</div>}
          </div>
          <p className="mt-1 font-medium text-slate-900">{entry.title}</p>
          {mode === 'simple' && entry.description && <p className="mt-0.5 text-sm text-slate-600">{entry.description}</p>}
          {mode === 'detailed' && entry.details && (
            <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{entry.details}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
