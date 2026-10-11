import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LoadError, Loading } from '../../../components/QueryState'
import { useDailyRevenue } from '../../../hooks/useReports'
import { formatDate, formatMoney } from '../../../utils/format'
import { fromPiastres, toPiastres } from '../../../utils/money'

// One series in the app's brand blue (sky-700; passes the dataviz palette checks on white).
const BAR = '#0369a1'
const GRID = '#e2e8f0'
const AXIS = '#64748b'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { date, revenue } = payload[0].payload
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-md ring-1 ring-slate-200">
      <p className="text-slate-600">{formatDate(date)}</p>
      <p className="font-semibold text-slate-900">{formatMoney(revenue)}</p>
    </div>
  )
}

/** 12500 → "12.5k" on the y axis; the tooltip and table give exact amounts. */
const compact = (value) => (value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(value))

/**
 * Revenue per day for one month (FR-H.4): a bar chart with a tooltip, an
 * empty state when nothing was received, and the same numbers as a table.
 */
export default function RevenueChart({ month, onMonthChange }) {
  const { t, i18n } = useTranslation()
  const rtl = i18n.dir() === 'rtl'
  const { data, isPending, isError, refetch } = useDailyRevenue(month)
  const [showTable, setShowTable] = useState(false)

  const total = data ? fromPiastres(data.reduce((sum, row) => sum + toPiastres(row.revenue), 0)) : '0.00'
  const empty = data && toPiastres(total) === 0
  const points = data?.map((row) => ({ ...row, day: Number(row.date.slice(8)), value: Number(row.revenue) }))

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{t('reports.chart.title')}</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          {t('reports.chart.month')}
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && onMonthChange(e.target.value)}
            className="rounded-lg border border-slate-500 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </label>
        {data && !empty && (
          <p className="text-sm text-slate-600 sm:ms-auto">
            {t('reports.chart.total')}: <span className="font-semibold text-slate-900">{formatMoney(total)}</span>
          </p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        {isPending ? (
          <Loading />
        ) : isError ? (
          <LoadError onRetry={refetch} />
        ) : empty ? (
          <p className="py-16 text-center text-slate-500">{t('reports.chart.empty')}</p>
        ) : (
          <>
            {/* overflow-hidden: the chart never widens the page, even before it has measured its box. */}
            <div dir="ltr" role="img" aria-label={t('reports.chart.label', { total: formatMoney(total) })} className="overflow-hidden">
              <ResponsiveContainer width="100%" height={280} initialDimension={{ width: 800, height: 280 }}>
                <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="day" reversed={rtl} tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis
                    orientation={rtl ? 'right' : 'left'}
                    tickFormatter={compact}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: AXIS, fontSize: 12 }}
                    width={44}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <button type="button" onClick={() => setShowTable((v) => !v)} className="mt-2 text-sm font-semibold text-sky-700 hover:underline">
              {showTable ? t('reports.chart.hideTable') : t('reports.chart.showTable')}
            </button>
            {showTable && (
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">{t('reports.chart.title')}</caption>
                <thead className="text-slate-600">
                  <tr>
                    <th scope="col" className="py-1 text-start font-medium">{t('reports.date')}</th>
                    <th scope="col" className="py-1 text-start font-medium">{t('reports.chart.revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row) => (
                    <tr key={row.date}>
                      <td className="py-1 text-slate-800">{formatDate(row.date)}</td>
                      <td className="py-1 text-slate-800">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </section>
  )
}
