import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import SelectField from '../../components/form/SelectField'
import TextAreaField from '../../components/form/TextAreaField'
import TextField from '../../components/form/TextField'
import { useStaffApi } from '../../staff/staffApi'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import Form from '../../components/form/Form'

const fromPatient = (patient) => ({
  name: patient.name,
  phone: patient.phone,
  address: patient.address,
  date_of_birth: patient.date_of_birth ?? '',
  gender: patient.gender ?? '',
  current_illness: patient.current_illness ?? '',
})

/**
 * Rendered only while open, so it always starts from the latest data. The
 * assistant edits contact info only (FR-I.3).
 */
export default function EditPatientModal({ patient, onClose }) {
  const { t } = useTranslation()
  const { useUpdatePatient, showIllness } = useStaffApi()
  const update = useUpdatePatient(patient.id)
  const [form, setForm] = useState(() => fromPatient(patient))
  const errors = fieldErrors(update.error)
  const formError = update.error && !Object.keys(errors).length ? errorMessage(update.error, t('common.networkError')) : ''

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    const fields = Object.entries(form).filter(([key]) => showIllness || key !== 'current_illness')
    const payload = Object.fromEntries(fields.map(([key, value]) => [key, value.trim() === '' ? null : value]))
    update.mutate(payload, { onSuccess: onClose })
  }

  return (
    <Modal open title={t('patientDetails.editTitle')} onClose={onClose}>
      <Form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <TextField label={t('patientForm.name')} value={form.name} onChange={set('name')} error={errors.name} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('patientForm.phone')} type="tel" dir="ltr" value={form.phone} onChange={set('phone')} error={errors.phone} required />
          <TextField label={t('patientForm.dateOfBirth')} type="date" value={form.date_of_birth} onChange={set('date_of_birth')} error={errors.date_of_birth} />
        </div>
        <TextField label={t('patientForm.address')} value={form.address} onChange={set('address')} error={errors.address} required />
        <SelectField
          label={t('patientForm.gender')}
          value={form.gender}
          onChange={set('gender')}
          error={errors.gender}
          options={[
            { value: '', label: t('patientForm.genderUnset') },
            { value: 'female', label: t('patientForm.female') },
            { value: 'male', label: t('patientForm.male') },
          ]}
        />
        {showIllness && (
          <TextAreaField label={t('patientForm.currentIllness')} value={form.current_illness} onChange={set('current_illness')} error={errors.current_illness} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={update.isPending} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
            {update.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
