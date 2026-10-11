import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { LoadError, Loading } from '../../../components/QueryState'
import StatusBadge from '../../../components/StatusBadge'
import { useStaffApi } from '../../../staff/staffApi'
import { useToast } from '../../../toast/useToast'
import { errorMessage } from '../../../utils/apiErrors'
import { formatTime } from '../../../utils/format'

/** No-show and Cancel ask first; Arrived is applied at once. */
const NEEDS_CONFIRM = ['no_show', 'cancelled']

function Actions({ appointment, onChange, busy, canStartVisit }) {
  const { t } = useTranslation()
  if (appointment.status === 'checked_in') {
    // The assistant has no Start visit: only the doctor writes the visit (FR-I.6).
    // The appointment travels with the link, so the form needs no extra request (FR-F.3).
    // Cancel covers a patient who arrived but left without a visit (§4.3).
    return (
      <div className="flex flex-wrap gap-2">
        {canStartVisit && (
          <Link
            to={`/doctor/visits/new?appointment=${appointment.id}`}
            state={{ appointment }}
            className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-800"
          >
            {t('schedule.startVisit')}
          </Link>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange(appointment, 'cancelled')}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
        >
          {t('schedule.cancel')}
        </button>
      </div>
    )
  }
  if (appointment.status !== 'booked') return null
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => onChange(appointment, 'checked_in')}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {t('schedule.arrived')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onChange(appointment, 'no_show')}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-60"
      >
        {t('schedule.noShow')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onChange(appointment, 'cancelled')}
        className="rounded-lg px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
      >
        {t('schedule.cancel')}
      </button>
    </div>
  )
}

/**
 * One day's appointments by time with status actions (FR-F.1, F.3, F.4).
 * `compact` (the dashboard's queue) leaves out the phone numbers.
 */
export default function DayView({ date, compact = false }) {
  const { useSchedule, useUpdateAppointmentStatus, canStartVisit } = useStaffApi()
  const { t } = useTranslation()
  const toast = useToast()
  const { data, isPending, isError, refetch } = useSchedule({ from: date, to: date })
  const updateStatus = useUpdateAppointmentStatus()
  const [pending, setPending] = useState(null) // { appointment, status } waiting for confirmation

  function apply(appointment, status) {
    updateStatus.mutate(
      { id: appointment.id, status },
      {
        onSuccess: () => toast.success(t(`schedule.done.${status}`, { name: appointment.patient.name })),
        onError: (error) => toast.error(errorMessage(error, t('common.networkError'))),
        onSettled: () => setPending(null),
      },
    )
  }

  function change(appointment, status) {
    if (NEEDS_CONFIRM.includes(status)) setPending({ appointment, status })
    else apply(appointment, status)
  }

  if (isPending) return <Loading />
  if (isError) return <LoadError onRetry={refetch} />

  return (
    <>
      {data.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-slate-500 ring-1 ring-slate-200">{t('schedule.emptyDay')}</p>
      ) : (
        <ul aria-label={t('schedule.appointments')} className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
          {data.map((appointment) => (
            <li
              key={appointment.id}
              className={`flex flex-col gap-3 sm:flex-row sm:items-center ${compact ? 'px-4 py-3' : 'p-4'} ${appointment.status === 'cancelled' ? 'opacity-60' : ''}`}
            >
              <span dir="ltr" className="w-28 shrink-0 font-semibold text-slate-900 rtl:text-end">
                {formatTime(appointment.start_at)} – {formatTime(appointment.end_at)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{appointment.patient.name}</p>
                {!compact && (
                  <p dir="ltr" className="text-sm text-slate-500 rtl:text-end">
                    {appointment.patient.phone}
                  </p>
                )}
              </div>
              <StatusBadge status={appointment.status} />
              <Actions appointment={appointment} onChange={change} busy={updateStatus.isPending} canStartVisit={canStartVisit} />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? t(`schedule.confirm.${pending.status}.title`) : ''}
        message={
          pending
            ? t(`schedule.confirm.${pending.status}.message`, {
                name: pending.appointment.patient.name,
                time: formatTime(pending.appointment.start_at),
              })
            : ''
        }
        confirmLabel={pending ? t(`schedule.confirm.${pending.status}.action`) : ''}
        onConfirm={() => apply(pending.appointment, pending.status)}
        onCancel={() => setPending(null)}
        busy={updateStatus.isPending}
      />
    </>
  )
}
