import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import Card from '../../components/Card'
import { LoadError, Loading } from '../../components/QueryState'
import StatusBadge from '../../components/StatusBadge'
import { useAssistantPatient } from '../../hooks/useAssistant'
import { formatDate, formatMoney, formatTime, todayInClinic } from '../../utils/format'
import AddPaymentModal from '../doctor/AddPaymentModal'
import EditPatientModal from '../doctor/EditPatientModal'
import BookForPatientModal from '../doctor/schedule/BookForPatientModal'
import VisitTimeline from '../doctor/VisitTimeline'

function InfoItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-900">{children || '—'}</dd>
    </div>
  )
}

/**
 * The front desk's patient page (FR-I.3, FR-I.4, FR-I.6): contact info (edit),
 * outstanding balance, next appointment with Book, and every visit's money
 * with Record payment. No illness, history or work done.
 */
export default function PatientPage() {
  const { t } = useTranslation()
  const id = Number(useParams().id)
  const { data: patient, isPending, isError, error, refetch } = useAssistantPatient(id)
  const [editing, setEditing] = useState(false)
  const [booking, setBooking] = useState(false)
  const [paying, setPaying] = useState(null)

  if (isPending) return <Loading />
  if (isError) {
    return error?.response?.status === 404 ? (
      <p className="py-8 text-center text-slate-500">{t('patientDetails.notFound')}</p>
    ) : (
      <LoadError onRetry={refetch} />
    )
  }

  const owes = Number(patient.outstanding_balance) > 0
  const next = patient.next_appointment

  return (
    <div className="space-y-4">
      <Link to="/assistant/patients" className="text-sm text-sky-700 hover:underline">
        {t('patientDetails.back')}
      </Link>

      <Card
        action={
          <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-sky-700 hover:underline">
            {t('patientDetails.edit')}
          </button>
        }
        title={<span className="text-2xl font-bold">{patient.name}</span>}
        headingLevel={1}
      >
        <p className={`mb-3 inline-block rounded-lg px-3 py-1 text-sm font-semibold ${owes ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {t('patientDetails.outstanding')}: <span data-testid="outstanding">{formatMoney(patient.outstanding_balance)}</span>
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoItem label={t('patientForm.phone')}>
            <span dir="ltr">{patient.phone}</span>
          </InfoItem>
          <InfoItem label={t('patientForm.address')}>{patient.address}</InfoItem>
          <InfoItem label={t('patientForm.dateOfBirth')}>{patient.date_of_birth && formatDate(patient.date_of_birth)}</InfoItem>
          <InfoItem label={t('patientForm.gender')}>{patient.gender && t(`patientForm.${patient.gender}`)}</InfoItem>
        </dl>
      </Card>

      <Card
        title={t('desk.nextAppointment')}
        action={
          <button
            type="button"
            onClick={() => setBooking(true)}
            className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-800"
          >
            {t('desk.bookAppointment')}
          </button>
        }
      >
        {next ? (
          <p className="flex flex-wrap items-center gap-2 text-slate-900">
            <span className="font-semibold">{formatDate(next.start_at)}</span>
            <span dir="ltr">{formatTime(next.start_at)}</span>
            <StatusBadge status={next.status} />
          </p>
        ) : (
          <p className="text-sm text-slate-500">{t('desk.noAppointment')}</p>
        )}
      </Card>

      <Card title={t('patientDetails.visits')}>
        <VisitTimeline visits={patient.visits} onAddPayment={setPaying} />
      </Card>

      {editing && <EditPatientModal patient={patient} onClose={() => setEditing(false)} />}
      {paying && <AddPaymentModal visit={paying} onClose={() => setPaying(null)} />}
      {booking && (
        <BookForPatientModal
          initialDate={todayInClinic()}
          initialPatient={{ id: patient.id, name: patient.name, phone: patient.phone }}
          onClose={() => setBooking(false)}
        />
      )}
    </div>
  )
}
