import { useTranslation } from 'react-i18next'
import { LoadError, Loading } from '../../../components/QueryState'
import StatusBadge from '../../../components/StatusBadge'
import { useStaffApi } from '../../../staff/staffApi'
import { addDays, dateRange, dayOfWeek } from '../../../utils/dates'
import { formatDate, formatTime, todayInClinic } from '../../../utils/format'

/**
 * Seven columns from Saturday (FR-F.2) with each day's appointments.
 * Clicking a day opens it in the day view.
 */
export default function WeekView({ start, onOpenDay }) {
  const { t } = useTranslation()
  const { useSchedule } = useStaffApi()
  const today = todayInClinic()
  const days = dateRange(start, 7)
  const { data, isPending, isError, refetch } = useSchedule({ from: start, to: addDays(start, 6) })

  if (isPending) return <Loading />
  if (isError) return <LoadError onRetry={refetch} />

  // start_at is clinic time with an offset, so its first 10 characters are the clinic date.
  const byDay = {}
  for (const appointment of data) (byDay[appointment.start_at.slice(0, 10)] ??= []).push(appointment)

  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const appointments = byDay[day] ?? []
        const active = appointments.filter((a) => a.status !== 'cancelled').length
        return (
          <section
            key={day}
            aria-label={`${t(`days.${dayOfWeek(day)}`)} ${formatDate(day)}`}
            aria-current={day === today ? 'date' : undefined}
            className={`flex min-h-32 flex-col rounded-xl bg-white ring-1 ${day === today ? 'ring-2 ring-sky-500' : 'ring-slate-200'}`}
          >
            <button
              type="button"
              onClick={() => onOpenDay(day)}
              aria-label={t('schedule.openDay', { day: `${t(`days.${dayOfWeek(day)}`)} ${formatDate(day)}` })}
              className="rounded-t-xl border-b border-slate-100 px-2 py-2 text-start hover:bg-slate-50"
            >
              <span className="block text-sm font-semibold text-slate-900">
                {t(`days.${dayOfWeek(day)}`)}
                {/* Today is not told by the ring colour alone (WCAG 1.4.1). */}
                {day === today && <span className="ms-1 rounded bg-sky-100 px-1 text-xs font-semibold text-sky-800">{t('schedule.today')}</span>}
              </span>
              <span className="block text-xs text-slate-500">{formatDate(day)}</span>
              <span className="mt-1 block text-xs text-sky-700">{t('schedule.count', { count: active })}</span>
            </button>
            <ul className="flex-1 space-y-1 p-2">
              {appointments.map((appointment) => (
                <li key={appointment.id} className={`rounded-lg bg-slate-50 px-2 py-1 text-xs ${appointment.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <span dir="ltr" className="font-semibold text-slate-900">
                    {formatTime(appointment.start_at)}
                  </span>{' '}
                  <span className="text-slate-700">{appointment.patient.name}</span>
                  <span className="mt-0.5 block">
                    <StatusBadge status={appointment.status} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
