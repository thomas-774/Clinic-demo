import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { addDays, dayOfWeek, weekStart } from '../../utils/dates'
import { formatDate, todayInClinic } from '../../utils/format'
import BookForPatientModal from './schedule/BookForPatientModal'
import DayView from './schedule/DayView'
import WeekView from './schedule/WeekView'

const navButton = 'rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'

/**
 * The schedule (FR-F.1 – F.4; the assistant's too, FR-I.6): a day view (default today) and a
 * week view. ?view=week and ?date= keep the place across reloads and links.
 */
export default function Schedule() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const today = todayInClinic()
  const date = params.get('date') ?? today
  const view = params.get('view') === 'week' ? 'week' : 'day'
  const [booking, setBooking] = useState(false)

  const show = (nextView, nextDate) =>
    setParams({ ...(nextView === 'week' && { view: 'week' }), ...(nextDate !== today && { date: nextDate }) })

  const step = view === 'week' ? 7 : 1
  const start = weekStart(date)
  const label =
    view === 'week'
      ? t('schedule.weekOf', { from: formatDate(start), to: formatDate(addDays(start, 6)) })
      : `${t(`days.${dayOfWeek(date)}`)} · ${formatDate(date)}`
  const showingToday = view === 'week' ? start === weekStart(today) : date === today

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t('pages.schedule')}</h1>
        <div role="group" aria-label={t('schedule.view')} className="flex rounded-lg bg-slate-100 p-0.5">
          {['day', 'week'].map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => show(option, date)}
              className={`rounded-md px-3 py-1 text-sm font-semibold ${view === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {t(`schedule.${option}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setBooking(true)}
          className="ms-auto rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {t('schedule.bookForPatient')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => show(view, addDays(date, -step))}
          className={navButton}
          aria-label={t(view === 'week' ? 'schedule.previousWeek' : 'schedule.previousDay')}
        >
          <span aria-hidden="true" className="rtl:inline-block rtl:rotate-180">
            ‹
          </span>
        </button>
        <h2 className="min-w-48 text-center text-lg font-semibold text-slate-900">{label}</h2>
        <button
          type="button"
          onClick={() => show(view, addDays(date, step))}
          className={navButton}
          aria-label={t(view === 'week' ? 'schedule.nextWeek' : 'schedule.nextDay')}
        >
          <span aria-hidden="true" className="rtl:inline-block rtl:rotate-180">
            ›
          </span>
        </button>
        {!showingToday && (
          <button type="button" onClick={() => show(view, today)} className={navButton}>
            {t(view === 'week' ? 'schedule.thisWeek' : 'schedule.today')}
          </button>
        )}
      </div>

      {view === 'week' ? <WeekView start={start} onOpenDay={(day) => show('day', day)} /> : <DayView date={date} />}

      {booking && <BookForPatientModal initialDate={date < today ? today : date} onClose={() => setBooking(false)} />}
    </div>
  )
}
