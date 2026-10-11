import { formatDate, formatTime } from '../utils/format'
import StatusBadge from './StatusBadge'

/** Date, time range and status of one appointment; `children` holds actions. */
export default function AppointmentCard({ appointment, children }) {
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-semibold text-slate-900">{formatDate(appointment.start_at)}</p>
        <p className="flex items-center gap-2 text-slate-700">
          <span dir="ltr">
            {formatTime(appointment.start_at)} – {formatTime(appointment.end_at)}
          </span>
          <StatusBadge status={appointment.status} />
        </p>
      </div>
      {children}
    </li>
  )
}
