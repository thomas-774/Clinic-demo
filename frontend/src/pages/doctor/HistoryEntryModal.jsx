import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import CheckboxField from '../../components/form/CheckboxField'
import SelectField from '../../components/form/SelectField'
import TextAreaField from '../../components/form/TextAreaField'
import TextField from '../../components/form/TextField'
import { useSaveHistoryEntry } from '../../hooks/usePatient'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import { todayInClinic } from '../../utils/format'
import { HISTORY_TYPES } from '../../utils/historyTypes'
import Form from '../../components/form/Form'

/** Add (entry = null) or edit a history entry. Rendered only while open. */
export default function HistoryEntryModal({ patientId, entry, onClose }) {
  const { t } = useTranslation()
  const save = useSaveHistoryEntry(patientId)
  const [form, setForm] = useState(() => ({
    type: entry?.type ?? 'condition',
    title: entry?.title ?? '',
    details: entry?.details ?? '',
    recorded_on: entry?.recorded_on ?? todayInClinic(),
    // New entries are private until the doctor chooses to share them.
    patient_visible: entry?.patient_visible ?? false,
  }))
  const errors = fieldErrors(save.error)
  const formError = save.error && !Object.keys(errors).length ? errorMessage(save.error, t('common.networkError')) : ''

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    save.mutate({ id: entry?.id, ...form, details: form.details.trim() || null }, { onSuccess: onClose })
  }

  return (
    <Modal open title={entry ? t('historyForm.editTitle') : t('historyForm.addTitle')} onClose={onClose}>
      <Form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label={t('historyForm.type')}
            value={form.type}
            onChange={set('type')}
            error={errors.type}
            options={HISTORY_TYPES.map((type) => ({ value: type, label: t(`history.types.${type}`) }))}
          />
          <TextField label={t('historyForm.recordedOn')} type="date" value={form.recorded_on} onChange={set('recorded_on')} error={errors.recorded_on} required />
        </div>
        <TextField label={t('historyForm.title')} value={form.title} onChange={set('title')} error={errors.title} required />
        <TextAreaField label={t('historyForm.details')} rows={4} value={form.details} onChange={set('details')} error={errors.details} />
        <CheckboxField
          label={t('historyForm.visible')}
          hint={t('historyForm.visibleHint')}
          checked={form.patient_visible}
          onChange={(event) => setForm((current) => ({ ...current, patient_visible: event.target.checked }))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
