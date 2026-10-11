import { useTranslation } from 'react-i18next'

/** §7.3 colours: Booked grey, Checked In blue, Completed green, No-show red, Cancelled muted. */
const STYLES = {
  booked: 'bg-slate-200 text-slate-800',
  checked_in: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600 line-through',
}

export default function StatusBadge({ status }) {
  const { t } = useTranslation()
  return (
    <span data-status={status} className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status] ?? STYLES.booked}`}>
      {t(`appointmentStatus.${status}`)}
    </span>
  )
}
