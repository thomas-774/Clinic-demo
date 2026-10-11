import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import DataTable from '../../../components/DataTable'
import { LoadError, Loading } from '../../../components/QueryState'
import { useAuditLogs } from '../../../hooks/useAuditLogs'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { usePatients } from '../../../hooks/usePatients'
import { useStaff } from '../../../hooks/useStaff'
import { formatDate, formatTime } from '../../../utils/format'

const AUDIT_ACTIONS = ['viewed', 'created', 'updated', 'deleted', 'exported', 'printed']

const control = 'rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-600'

/**
 * The patient filter: a search box with matching patients, or the chosen
 * patient with a way back to all patients. The patient id lives in ?patient=,
 * so "Activity on this patient" can link here.
 */
function PatientFilter({ patientId, patientName, onChange }) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 300)
  const patients = usePatients({ search: debounced, page: 1 })

  if (patientId) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm">
        <span className="text-slate-600">{t('activity.patient')}:</span>
        <span className="font-semibold text-slate-900" dir="auto">
          {patientName ?? `#${patientId}`}
        </span>
        <button type="button" onClick={() => onChange(null)} className="ms-2 font-semibold text-sky-700 hover:underline">
          {t('activity.clearPatient')}
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full sm:w-64">
      <input
        type="search"
        dir="auto"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('activity.patientPlaceholder')}
        aria-label={t('activity.patient')}
        className={`${control} w-full`}
      />
      {debounced !== '' && (
        <ul
          aria-label={t('activity.matchingPatients')}
          className="absolute z-10 mt-1 max-h-56 w-full divide-y divide-slate-100 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-slate-200"
        >
          {(patients.data?.data ?? []).map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  onChange(row)
                }}
                className="flex w-full justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-slate-50"
              >
                <span dir="auto">{row.name}</span>
                <span dir="ltr" className="text-slate-500">
                  {row.phone}
                </span>
              </button>
            </li>
          ))}
          {patients.data?.data.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t('activity.noPatientMatch')}</li>}
        </ul>
      )}
    </div>
  )
}

/**
 * Settings → Activity (NFR-S.5): who opened or changed medical and money
 * records, filtered by patient, user, action and date range, 50 a page.
 */
export default function ActivityTab() {
  const { t, i18n } = useTranslation()
  const { user: me } = useAuth()
  const staff = useStaff()
  const [params, setParams] = useSearchParams()
  const patientId = Number(params.get('patient')) || null
  const [pickedName, setPickedName] = useState(null)
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  // A new filter starts again at page 1.
  const [filters, setFilters] = useState({ patientId, userId, action, from, to })
  if (filters.patientId !== patientId || filters.userId !== userId || filters.action !== action || filters.from !== from || filters.to !== to) {
    setFilters({ patientId, userId, action, from, to })
    setPage(1)
  }

  const { data, isPending, isError, refetch } = useAuditLogs({ patientId, userId, action, from, to, page })

  function choosePatient(patient) {
    setPickedName(patient?.name ?? null)
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (patient) next.set('patient', String(patient.id))
        else next.delete('patient')
        return next
      },
      { replace: true },
    )
  }

  const separator = i18n.dir() === 'rtl' ? '، ' : ', '
  const users = [...(me ? [{ id: me.id, name: me.name, role: 'doctor' }] : []), ...(staff.data ?? []).map((s) => ({ id: s.id, name: s.name, role: 'assistant' }))]

  const columns = [
    {
      key: 'time',
      header: t('activity.columns.time'),
      className: 'whitespace-nowrap',
      render: (row) => (
        <>
          {formatDate(row.created_at)} <span dir="ltr">{formatTime(row.created_at)}</span>
        </>
      ),
    },
    {
      key: 'user',
      header: t('activity.columns.user'),
      render: (row) => (
        <>
          <span dir="auto">{row.user?.name ?? t('activity.deletedUser')}</span>
          {row.user_role && <span className="block text-xs text-slate-500">{t(`activity.roles.${row.user_role}`)}</span>}
        </>
      ),
    },
    { key: 'action', header: t('activity.columns.action'), render: (row) => <span className="font-medium">{t(`activity.actions.${row.action}`)}</span> },
    {
      key: 'record',
      header: t('activity.columns.record'),
      render: (row) => (
        <>
          {row.record.label} <span className="text-slate-500">#{row.record.id}</span>
        </>
      ),
    },
    {
      key: 'patient',
      header: t('activity.columns.patient'),
      render: (row) =>
        row.patient ? (
          <Link to={`/doctor/patients/${row.patient.id}`} dir="auto" className="text-sky-800 hover:underline">
            {row.patient.name}
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'fields', header: t('activity.columns.fields'), render: (row) => row.changed_fields.map((field) => field.label).join(separator) || '—' },
    { key: 'ip', header: t('activity.columns.ip'), render: (row) => <span dir="ltr">{row.ip}</span> },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{t('activity.intro')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <PatientFilter patientId={patientId} patientName={data?.filters?.patient?.name ?? pickedName} onChange={choosePatient} />
        <select aria-label={t('activity.user')} value={userId} onChange={(event) => setUserId(event.target.value)} className={control}>
          <option value="">{t('activity.allUsers')}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {t(`activity.roles.${u.role}`)}
            </option>
          ))}
        </select>
        <select aria-label={t('activity.action')} value={action} onChange={(event) => setAction(event.target.value)} className={control}>
          <option value="">{t('activity.allActions')}</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`activity.actions.${a}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          {t('activity.from')}
          <input type="date" dir="ltr" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className={control} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          {t('activity.to')}
          <input type="date" dir="ltr" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className={control} />
        </label>
      </div>

      {isPending ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={refetch} />
      ) : (
        <>
          <p className="text-sm text-slate-500">{t('activity.count', { total: data.meta?.total ?? data.data.length })}</p>
          <DataTable
            columns={columns}
            rows={data.data}
            emptyMessage={t('activity.empty')}
            pagination={{ page: data.meta?.current_page ?? page, lastPage: data.meta?.last_page ?? 1, onPageChange: setPage }}
          />
        </>
      )}
    </div>
  )
}
