import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import DataTable from '../../components/DataTable'
import { LoadError, Loading } from '../../components/QueryState'
import { useReportPayments } from '../../hooks/useReports'
import { addDays, monthRange, weekStart } from '../../utils/dates'
import { formatDate, formatMoney, todayInClinic } from '../../utils/format'
import RevenueChart from './reports/RevenueChart'

const PERIODS = ['day', 'week', 'month', 'custom']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

/** [from, to] for a period, as inclusive "YYYY-MM-DD" dates in clinic time. */
function rangeOf(period, today, params) {
  if (period === 'day') return { from: today, to: today }
  if (period === 'week') return { from: weekStart(today), to: addDays(weekStart(today), 6) }
  const month = monthRange(today)
  if (period === 'month') return month
  return { from: params.get('from') ?? month.from, to: params.get('to') ?? month.to }
}

const dateInput =
  'rounded-lg border border-slate-500 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600'

/**
 * Reports: a period filter kept in the URL (?period=day|week|custom, this
 * month by default; ?from=&to= for a custom range; ?page=), the payments
 * table with a totals row for the whole range (FR-H.3), and the daily revenue
 * chart for ?month=YYYY-MM, this month by default (FR-H.4).
 */
export default function Reports() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const period = PERIODS.includes(params.get('period')) ? params.get('period') : 'month'
  const today = todayInClinic()
  const { from, to } = rangeOf(period, today, params)
  const month = MONTH.test(params.get('month') ?? '') ? params.get('month') : today.slice(0, 7)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const validRange = DATE.test(from) && DATE.test(to) && from <= to

  // The table filter and the chart month are independent: changing one keeps the other.
  const keepMonth = params.has('month') ? { month } : {}
  const choosePeriod = (next) => {
    if (next === 'month') setParams(keepMonth)
    else if (next === 'custom') setParams({ period: 'custom', from, to, ...keepMonth })
    else setParams({ period: next, ...keepMonth })
  }
  const setCustom = (field, value) => setParams({ period: 'custom', from, to, ...keepMonth, [field]: value })
  const chooseMonth = (next) => {
    const nextParams = new URLSearchParams(params)
    if (next === today.slice(0, 7)) nextParams.delete('month')
    else nextParams.set('month', next)
    setParams(nextParams)
  }
  const goToPage = (next) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('page', String(next))
    setParams(nextParams)
  }

  const payments = useReportPayments({ from, to, page }, { enabled: validRange })

  const columns = [
    { key: 'visit_date', header: t('reports.visitDate'), render: (row) => formatDate(row.visit_date), className: 'whitespace-nowrap' },
    {
      key: 'patient',
      header: t('reports.patient'),
      render: (row) => (
        <Link to={`/doctor/patients/${row.patient_id}`} className="font-medium text-sky-800 hover:underline">
          {row.patient_name}
        </Link>
      ),
    },
    { key: 'visit_total', header: t('reports.visitTotal'), render: (row) => formatMoney(row.visit_total), className: 'whitespace-nowrap' },
    {
      key: 'paid',
      header: t('reports.paid'),
      className: 'whitespace-nowrap',
      // Money counts on the visit date; show when it was actually paid if that was another day.
      render: (row) => {
        const paidOn = formatDate(row.paid_at)
        return (
          <>
            {formatMoney(row.paid)}
            {paidOn !== formatDate(row.visit_date) && <span className="block text-xs text-slate-500">{t('reports.paidOn', { date: paidOn })}</span>}
          </>
        )
      },
    },
    { key: 'remaining', header: t('reports.remaining'), render: (row) => formatMoney(row.remaining), className: 'whitespace-nowrap' },
    { key: 'recorded_by', header: t('reports.recordedBy'), render: (row) => row.recorded_by_name ?? '—' },
  ]

  const totals = payments.data?.meta.totals

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t('pages.reports')}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t('reports.period')} className="flex flex-wrap rounded-lg bg-slate-100 p-0.5">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => choosePeriod(option)}
              className={`rounded-md px-3 py-1 text-sm font-semibold ${period === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {t(`reports.periods.${option}`)}
            </button>
          ))}
        </div>

        {period === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              {t('reports.from')}
              <input type="date" value={from} max={to} onChange={(e) => setCustom('from', e.target.value)} className={dateInput} />
            </label>
            <label className="flex items-center gap-2">
              {t('reports.to')}
              <input type="date" value={to} min={from} onChange={(e) => setCustom('to', e.target.value)} className={dateInput} />
            </label>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{from === to ? formatDate(from) : t('dashboard.range', { from: formatDate(from), to: formatDate(to) })}</p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">{t('reports.payments')}</h2>
        {!validRange ? (
          <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-800">
            {t('reports.invalidRange')}
          </p>
        ) : payments.isPending ? (
          <Loading />
        ) : payments.isError ? (
          <LoadError onRetry={payments.refetch} />
        ) : (
          <DataTable
            columns={columns}
            rows={payments.data.data}
            emptyMessage={t('reports.empty')}
            pagination={{ page: payments.data.meta.current_page, lastPage: payments.data.meta.last_page, onPageChange: goToPage }}
            footer={{
              visit_date: t('reports.totals'),
              paid: formatMoney(totals.paid),
              remaining: formatMoney(totals.remaining),
            }}
          />
        )}
      </section>

      <RevenueChart month={month} onMonthChange={chooseMonth} />
    </div>
  )
}
