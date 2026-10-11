import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import SelectField from '../../components/form/SelectField'
import TextAreaField from '../../components/form/TextAreaField'
import TextField from '../../components/form/TextField'
import { useStaffApi } from '../../staff/staffApi'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import Form from '../../components/form/Form'

const EMPTY = { name: '', phone: '', address: '', email: '', date_of_birth: '', gender: '', current_illness: '' }

/** Shows the generated password once, with a copy button (FR-C.6). */
function CreatedStep({ patient, onClose }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(patient.initial_password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-700">{t('newPatient.created', { name: patient.name })}</p>
      <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <p className="text-sm text-amber-900">{t('newPatient.passwordOnce')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code dir="ltr" data-testid="initial-password" className="rounded-lg bg-white px-3 py-1.5 text-lg font-bold tracking-widest text-slate-900 ring-1 ring-amber-200">
            {patient.initial_password}
          </code>
          <button type="button" onClick={copy} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50">
            {copied ? t('newPatient.copied') : t('newPatient.copy')}
          </button>
        </div>
        <p className="mt-2 text-sm text-amber-900">
          {t('newPatient.loginWith')} <span dir="ltr" className="font-semibold">{patient.phone}</span>
        </p>
      </div>
      <button type="button" onClick={onClose} className="w-full rounded-lg bg-sky-700 px-4 py-2.5 font-semibold text-white hover:bg-sky-800">
        {t('newPatient.done')}
      </button>
    </div>
  )
}

/** The assistant's form has no current illness: that is medical data (FR-I.2). */
export default function NewPatientModal({ open, onClose }) {
  const { t } = useTranslation()
  const { useCreatePatient, showIllness } = useStaffApi()
  const create = useCreatePatient()
  const [form, setForm] = useState(EMPTY)
  const errors = fieldErrors(create.error)
  const formError = create.error && !Object.keys(errors).length ? errorMessage(create.error, t('common.networkError')) : ''

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  function close() {
    setForm(EMPTY)
    create.reset()
    onClose()
  }

  function handleSubmit(event) {
    event.preventDefault()
    // Empty optional fields are sent as null so the API treats them as "not given".
    const fields = Object.entries(form).filter(([key]) => showIllness || key !== 'current_illness')
    const payload = Object.fromEntries(fields.map(([key, value]) => [key, value.trim() === '' ? null : value]))
    create.mutate(payload)
  }

  return (
    <Modal open={open} onClose={close} title={create.data ? t('newPatient.createdTitle') : t('newPatient.title')}>
      {create.data ? (
        <CreatedStep patient={create.data} onClose={close} />
      ) : (
        <Form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <TextField label={t('patientForm.name')} value={form.name} onChange={set('name')} error={errors.name} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={t('patientForm.phone')} type="tel" dir="ltr" value={form.phone} onChange={set('phone')} error={errors.phone} required />
            <TextField label={t('patientForm.email')} type="email" dir="ltr" value={form.email} onChange={set('email')} error={errors.email} />
          </div>
          <TextField label={t('patientForm.address')} value={form.address} onChange={set('address')} error={errors.address} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={t('patientForm.dateOfBirth')} type="date" value={form.date_of_birth} onChange={set('date_of_birth')} error={errors.date_of_birth} />
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
          </div>
          {showIllness && (
            <TextAreaField label={t('patientForm.currentIllness')} value={form.current_illness} onChange={set('current_illness')} error={errors.current_illness} />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={create.isPending} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
              {create.isPending ? t('common.saving') : t('newPatient.submit')}
            </button>
          </div>
        </Form>
      )}
    </Modal>
  )
}
