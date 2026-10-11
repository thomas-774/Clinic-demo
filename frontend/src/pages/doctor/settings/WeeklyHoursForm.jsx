import { useTranslation } from 'react-i18next'
import Card from '../../../components/Card'
import { WEEK_ORDER } from '../../../utils/schedule'
import Form from '../../../components/form/Form'

/** A sensible new range: after the day's last range, else the usual evening shift. */
function nextRange(ranges) {
  if (!ranges.length) return { start_time: '17:00', end_time: '21:00' }
  const last = ranges[ranges.length - 1].end_time
  const [h, m] = last.split(':').map(Number)
  const end = Math.min(h * 60 + m + 60, 23 * 60 + 59)
  return { start_time: last, end_time: `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}` }
}

const timeInput = (error) =>
  `w-28 rounded-lg border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-600 focus:ring-red-600' : 'border-slate-500 focus:ring-sky-600'}`

/**
 * Weekly grid: each day lists its ranges (start, end, remove) with "Add range";
 * a day without ranges is a day off (FR-G.1). `week` is indexed by day_of_week.
 * `errors` uses the API keys, e.g. "days.2.ranges.0.end_time".
 */
export default function WeeklyHoursForm({ week, onChange, errors, onSave, saving, renderPreview }) {
  const { t } = useTranslation()

  const setRanges = (day, ranges) => onChange(week.map((entry) => (entry.day_of_week === day ? { ...entry, ranges } : entry)))

  return (
    <Card title={t('settings.weeklyHours')}>
      <Form
       
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <ul className="divide-y divide-slate-100">
          {WEEK_ORDER.map((day) => {
            const { ranges } = week[day]
            const dayName = t(`days.${day}`)
            return (
              <li key={day} className="py-3" aria-label={dayName}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <span className="w-24 shrink-0 pt-1.5 font-medium text-slate-900">{dayName}</span>
                  <div className="flex-1 space-y-2">
                    {ranges.length === 0 && <p className="pt-1.5 text-sm text-slate-500">{t('settings.dayOff')}</p>}
                    {ranges.map((range, index) => {
                      const key = `days.${day}.ranges.${index}`
                      const error = errors[`${key}.start_time`] || errors[`${key}.end_time`]
                      const update = (field) => (event) =>
                        setRanges(day, ranges.map((r, i) => (i === index ? { ...r, [field]: event.target.value } : r)))
                      return (
                        <div key={index}>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="time"
                              aria-label={t('settings.rangeStart', { day: dayName, n: index + 1 })}
                              value={range.start_time}
                              onChange={update('start_time')}
                              aria-invalid={errors[`${key}.start_time`] ? true : undefined}
                              className={timeInput(errors[`${key}.start_time`])}
                            />
                            <span className="text-slate-500">–</span>
                            <input
                              type="time"
                              aria-label={t('settings.rangeEnd', { day: dayName, n: index + 1 })}
                              value={range.end_time}
                              onChange={update('end_time')}
                              aria-invalid={errors[`${key}.end_time`] ? true : undefined}
                              className={timeInput(errors[`${key}.end_time`])}
                            />
                            <button
                              type="button"
                              onClick={() => setRanges(day, ranges.filter((_, i) => i !== index))}
                              aria-label={t('settings.removeRange', { day: dayName, n: index + 1 })}
                              className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              {t('settings.remove')}
                            </button>
                          </div>
                          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setRanges(day, [...ranges, nextRange(ranges)])}
                      aria-label={t('settings.addRangeFor', { day: dayName })}
                      className="text-sm font-medium text-sky-700 hover:underline"
                    >
                      {t('settings.addRange')}
                    </button>
                    {renderPreview?.(day)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <button type="submit" disabled={saving} className="mt-3 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
          {saving ? t('common.saving') : t('settings.saveHours')}
        </button>
      </Form>
    </Card>
  )
}
