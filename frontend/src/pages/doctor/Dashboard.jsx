import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import { LoadError } from '../../components/QueryState'
import StatCard from '../../components/StatCard'
import { useReportSummary } from '../../hooks/useReports'
import { formatDate, formatMoney, todayInClinic } from '../../utils/format'
import OutstandingModal from './OutstandingModal'
import DayView from './schedule/DayView'

const PERIODS = [
  { period: 'day', title: 'dashboard.today' },
  { period: 'week', title: 'dashboard.thisWeek' },
  { period: 'month', title: 'dashboard.thisMonth' },
]

/** Today / this week / this month: number of visits and revenue by visit date (FR-H.1). */
function PeriodGroup({ period, title }) {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useReportSummary(period)
  const range = data && (data.from === data.to ? formatDate(data.from) : t('dashboard.range', { from: formatDate(data.from), to: formatDate(data.to) }))

  return (
    <Card title={t(title)} action={range && <span className="text-xs text-slate-500">{range}</span>}>
      {isError ? (
        <LoadError onRetry={refetch} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1" aria-busy={isPending}>
          <StatCard label={t('dashboard.visits')} value={isPending ? '…' : data.visits} />
          <StatCard label={t('dashboard.revenue')} value={isPending ? '…' : formatMoney(data.revenue)} />
        </div>
      )}
    </Card>
  )
}

/**
 * The doctor's home (§7.2): the three period groups, outstanding balances on
 * their own (FR-H.2 — never added into revenue) and today's queue.
 */
export default function Dashboard() {
  const { t } = useTranslation()
  // Outstanding does not depend on the period; the "day" summary is already loaded.
  const today = useReportSummary('day')
  const [showOwing, setShowOwing] = useState(false)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('pages.dashboard')}</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        {PERIODS.map((group) => (
          <PeriodGroup key={group.period} {...group} />
        ))}
      </div>

      <Card title={t('dashboard.outstandingTitle')} className="sm:max-w-sm">
        {today.isError ? (
          <LoadError onRetry={today.refetch} />
        ) : (
          <StatCard
            label={t('dashboard.outstanding')}
            value={today.isPending ? '…' : formatMoney(today.data.outstanding)}
            sub={`${t('dashboard.outstandingHint')} ${t('dashboard.viewDetails')}`}
            tone="warning"
            onClick={() => setShowOwing(true)}
          />
        )}
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.queue')}</h2>
          <Link to="/doctor/schedule" className="text-sm font-semibold text-sky-700 hover:underline">
            {t('dashboard.openSchedule')}
          </Link>
        </div>
        <DayView date={todayInClinic()} compact />
      </section>

      <OutstandingModal open={showOwing} onClose={() => setShowOwing(false)} />
    </div>
  )
}
