import { useTranslation } from 'react-i18next'

/** PR-3 states: Paid green, Partially paid amber, Unpaid red. */
const STYLES = {
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  unpaid: 'bg-red-100 text-red-800',
}

export default function PaymentStatusBadge({ status }) {
  const { t } = useTranslation()
  return (
    <span data-status={status} className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status] ?? STYLES.unpaid}`}>
      {t(`paymentStatus.${status}`)}
    </span>
  )
}
