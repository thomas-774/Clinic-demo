import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AppointmentCard from '../../components/AppointmentCard'
import Card from '../../components/Card'
import ConfirmDialog from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/QueryState'
import { useCancelMyAppointment, useMyAppointments } from '../../hooks/useAppointments'
import { useToast } from '../../toast/useToast'
import { errorMessage } from '../../utils/apiErrors'
import { formatDate, formatTime } from '../../utils/format'

/**
 * Upcoming and past appointments (FR-E.4). Whether an appointment can still
 * be cancelled comes from the server (can_cancel, BR-5).
 */
export default function MyAppointments() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data, isPending, isError, refetch } = useMyAppointments()
  const cancel = useCancelMyAppointment()
  const [toCancel, setToCancel] = useState(null)

  if (isPending) return <Loading />
  if (isError) return <LoadError onRetry={refetch} />

  function confirmCancel() {
    cancel.mutate(toCancel.id, {
      onSuccess: () => toast.success(t('myAppointments.cancelled')),
      onError: (error) => toast.error(errorMessage(error, t('common.networkError'))),
      onSettled: () => setToCancel(null),
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{t('pages.myAppointments')}</h1>

      <Card title={t('myAppointments.upcoming')}>
        {data.upcoming.length ? (
          <ul aria-label={t('myAppointments.upcoming')} className="space-y-2">
            {data.upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment}>
                {appointment.status === 'booked' &&
                  (appointment.can_cancel ? (
                    <button
                      type="button"
                      onClick={() => setToCancel(appointment)}
                      className="min-h-11 w-full rounded-lg px-4 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 sm:w-auto"
                    >
                      {t('myAppointments.cancel')}
                    </button>
                  ) : (
                    <p className="text-sm text-amber-800 sm:max-w-56">{t('myAppointments.tooLate')}</p>
                  ))}
              </AppointmentCard>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-sm text-slate-500">{t('myAppointments.noUpcoming')}</p>
            <Link
              to="/patient/book"
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-700 px-4 font-semibold text-white hover:bg-sky-800 sm:w-auto"
            >
              {t('patientHome.bookNow')}
            </Link>
          </>
        )}
      </Card>

      <Card title={t('myAppointments.past')}>
        {data.past.length ? (
          <ul aria-label={t('myAppointments.past')} className="space-y-2">
            {data.past.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t('myAppointments.noPast')}</p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={t('myAppointments.cancelTitle')}
        message={toCancel ? t('myAppointments.cancelMessage', { date: formatDate(toCancel.start_at), time: formatTime(toCancel.start_at) }) : ''}
        confirmLabel={t('myAppointments.confirmCancel')}
        onConfirm={confirmCancel}
        onCancel={() => setToCancel(null)}
        busy={cancel.isPending}
      />
    </div>
  )
}
