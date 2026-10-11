import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../../../components/Card'
import PrescriptionPrint from '../../../components/PrescriptionPrint'
import TextField from '../../../components/form/TextField'
import { useAuth } from '../../../auth/useAuth'
import { useUpdateSettings } from '../../../hooks/useSettings'
import { useToast } from '../../../toast/useToast'
import { errorMessage, fieldErrors } from '../../../utils/apiErrors'
import { todayInClinic } from '../../../utils/format'
import Form from '../../../components/form/Form'

const TEXT_FIELDS = ['clinic_name', 'doctor_title', 'clinic_address', 'clinic_phone', 'prescription_footer']
const PAPERS = ['A5', 'A4']

/**
 * Settings → Prescription (FR-J.6): the print header (clinic name, doctor
 * title, address, phone, footer) and the paper size, with a live preview of
 * a sample prescription drawn by the real print component.
 */
export default function PrescriptionHeaderTab({ settings }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { user } = useAuth()
  const save = useUpdateSettings()
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, settings[field] ?? ''])),
    prescription_paper: settings.prescription_paper ?? 'A5',
  }))

  const errors = fieldErrors(save.error)
  const formError = save.error && !Object.keys(errors).length ? errorMessage(save.error, t('common.networkError')) : ''
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    save.mutate(
      {
        ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, form[field].trim() || null])),
        prescription_paper: form.prescription_paper,
      },
      {
        onSuccess: () => toast.success(t('rxSettings.saved')),
        onError: (error) => error?.response?.status === 422 && toast.error(t('settings.fixErrors')),
      },
    )
  }

  const sample = {
    issued_on: todayInClinic(),
    notes: t('rxSettings.sampleNotes'),
    patient: { name: t('rxSettings.samplePatient'), age: 34 },
    items: [
      { id: 1, drug_name: 'Augmentin 1 g', drug_form: t('rxSettings.sampleForm'), instructions: t('rxSettings.sampleDose1') },
      { id: 2, drug_name: 'Panadol Extra', drug_form: null, instructions: t('rxSettings.sampleDose2') },
    ],
    print: {
      doctor_name: user?.name,
      doctor_title: form.doctor_title.trim(),
      clinic_name: form.clinic_name.trim(),
      clinic_address: form.clinic_address.trim(),
      clinic_phone: form.clinic_phone.trim(),
      footer: form.prescription_footer.trim(),
      paper: form.prescription_paper,
    },
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
      <Card title={t('rxSettings.title')}>
        <Form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm text-slate-500">{t('rxSettings.intro')}</p>
          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <TextField label={t('rxSettings.clinicName')} dir="auto" value={form.clinic_name} onChange={set('clinic_name')} error={errors.clinic_name} />
          <TextField label={t('rxSettings.doctorTitle')} dir="auto" value={form.doctor_title} onChange={set('doctor_title')} error={errors.doctor_title} hint={t('rxSettings.doctorTitleHint')} />
          <TextField label={t('rxSettings.address')} dir="auto" value={form.clinic_address} onChange={set('clinic_address')} error={errors.clinic_address} />
          <TextField label={t('rxSettings.phone')} dir="ltr" type="tel" value={form.clinic_phone} onChange={set('clinic_phone')} error={errors.clinic_phone} />
          <TextField label={t('rxSettings.footer')} dir="auto" value={form.prescription_footer} onChange={set('prescription_footer')} error={errors.prescription_footer} hint={t('rxSettings.footerHint')} />

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">{t('rxSettings.paper')}</legend>
            <div className="mt-1 flex gap-4">
              {PAPERS.map((paper) => (
                <label key={paper} className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="prescription_paper"
                    value={paper}
                    checked={form.prescription_paper === paper}
                    onChange={set('prescription_paper')}
                    className="h-4 w-4 border-slate-300 text-sky-700 focus:ring-sky-600"
                  />
                  {t(`rxSettings.paper${paper}`)}
                </label>
              ))}
            </div>
            {errors.prescription_paper && <p className="mt-1 text-sm text-red-600">{errors.prescription_paper}</p>}
          </fieldset>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-lg bg-sky-700 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
            >
              {save.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </Form>
      </Card>

      <section aria-label={t('rxSettings.preview')} className="min-w-0">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('rxSettings.preview')}</h2>
        {/* Drawn at real size, then zoomed out to fit beside the form. */}
        <div className="overflow-x-auto rounded-xl bg-slate-100 p-4">
          <div style={{ zoom: 0.6 }}>
            <PrescriptionPrint prescription={sample} className="mx-auto shadow-lg" />
          </div>
        </div>
      </section>
    </div>
  )
}
