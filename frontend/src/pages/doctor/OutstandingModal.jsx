import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Modal from '../../components/Modal'
import { LoadError, Loading } from '../../components/QueryState'
import { useOutstanding } from '../../hooks/useReports'
import { formatDate, formatMoney } from '../../utils/format'

/** Who owes money and how much, largest balance first; each name opens the patient. */
export default function OutstandingModal({ open, onClose }) {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch } = useOutstanding({ enabled: open })

  return (
    <Modal open={open} title={t('dashboard.whoOwes')} onClose={onClose} size="lg">
      {isPending ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={refetch} />
      ) : data.data.length === 0 ? (
        <p className="py-6 text-center text-slate-500">{t('dashboard.nobodyOwes')}</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600">
              <tr>
                <th scope="col" className="py-2 pe-3 text-start font-medium">{t('dashboard.patient')}</th>
                <th scope="col" className="py-2 pe-3 text-start font-medium">{t('dashboard.phone')}</th>
                <th scope="col" className="py-2 pe-3 text-start font-medium">{t('dashboard.unpaidVisits')}</th>
                <th scope="col" className="py-2 pe-3 text-start font-medium">{t('dashboard.since')}</th>
                <th scope="col" className="py-2 text-start font-medium">{t('dashboard.amountDue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((row) => (
                <tr key={row.patient_id}>
                  <td className="py-2 pe-3">
                    <Link to={`/doctor/patients/${row.patient_id}`} onClick={onClose} className="font-medium text-sky-800 hover:underline">
                      {row.patient_name}
                    </Link>
                  </td>
                  <td dir="ltr" className="py-2 pe-3 text-slate-700 rtl:text-end">
                    {row.phone}
                  </td>
                  <td className="py-2 pe-3 text-slate-700">{row.unpaid_visits}</td>
                  <td className="whitespace-nowrap py-2 pe-3 text-slate-700">{formatDate(row.oldest_visit_date)}</td>
                  <td className="whitespace-nowrap py-2 font-semibold text-amber-700">{formatMoney(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <tr>
                <td colSpan={4} className="py-2">
                  {t('reports.totals')}
                </td>
                <td className="whitespace-nowrap py-2">{formatMoney(data.meta.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  )
}
