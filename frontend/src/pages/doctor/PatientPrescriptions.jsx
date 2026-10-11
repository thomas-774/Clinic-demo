import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import ConfirmDialog from '../../components/ConfirmDialog'
import { LoadError, Loading } from '../../components/QueryState'
import { useDeletePrescription } from '../../hooks/usePrescriptions'
import { useToast } from '../../toast/useToast'
import { errorMessage } from '../../utils/apiErrors'
import { formatDate } from '../../utils/format'

const smallButton = 'rounded-md px-2 py-1 text-xs font-semibold hover:bg-slate-100'

/**
 * The patient's prescriptions on PatientDetails (FR-J.7): date, drug names
 * and the linked visit, with Open / Edit, Reprint and Delete, and a "Write
 * prescription" button. `prescriptions` is the usePatientPrescriptions query.
 */
export default function PatientPrescriptions({ patient, prescriptions }) {
  const { t } = useTranslation()
  const toast = useToast()
  const remove = useDeletePrescription()
  const [deleting, setDeleting] = useState(null)

  const visitDates = Object.fromEntries((patient.visits ?? []).map((visit) => [visit.id, visit.visit_date]))
  const hasAny = patient.prescriptions_count > 0

  let body
  if (!hasAny) {
    body = <p className="text-sm text-slate-500">{t('prescriptions.empty')}</p>
  } else if (prescriptions.isPending) {
    body = <Loading />
  } else if (prescriptions.isError) {
    body = <LoadError onRetry={prescriptions.refetch} />
  } else {
    body = (
      <ul aria-label={t('prescriptions.title')} className="divide-y divide-slate-100">
        {prescriptions.data.map((prescription) => {
          const date = formatDate(prescription.issued_on)
          const visitDate = visitDates[prescription.visit_id]
          return (
            <li key={prescription.id} aria-label={date} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {date}
                  {visitDate && (
                    <span className="ms-2 text-xs font-normal text-slate-500">
                      {t('prescriptions.forVisit', { date: formatDate(visitDate) })}
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-700">
                  {prescription.drug_names.map((name, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <bdi>{name}</bdi>
                    </span>
                  ))}
                </p>
              </div>
              <div className="flex gap-1">
                <Link
                  to={`/doctor/prescriptions/${prescription.id}/edit`}
                  aria-label={t('prescriptions.openLabel', { date })}
                  className={`${smallButton} text-sky-700`}
                >
                  {t('prescriptions.open')}
                </Link>
                <Link
                  to={`/doctor/prescriptions/${prescription.id}/print`}
                  aria-label={t('prescriptions.reprintLabel', { date })}
                  className={`${smallButton} text-slate-700`}
                >
                  {t('prescriptions.reprint')}
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleting(prescription)}
                  aria-label={t('prescriptions.deleteLabel', { date })}
                  className={`${smallButton} text-red-600`}
                >
                  {t('prescriptions.delete')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Card
      title={t('prescriptions.title')}
      action={
        <Link
          to={`/doctor/patients/${patient.id}/prescriptions/new`}
          className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-800"
        >
          {t('prescriptions.write')}
        </Link>
      }
    >
      {body}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('prescriptions.deleteTitle')}
        message={t('prescriptions.deleteMessage', { date: deleting ? formatDate(deleting.issued_on) : '' })}
        confirmLabel={t('prescriptions.delete')}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null)
              toast.success(t('prescriptions.deleted'))
            },
            onError: (error) => toast.error(errorMessage(error, t('common.networkError'))),
          })
        }
      />
    </Card>
  )
}
