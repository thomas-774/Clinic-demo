import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import MoneyField from '../../components/MoneyField'
import TextAreaField from '../../components/form/TextAreaField'
import { useUpdateVisit } from '../../hooks/useVisits'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import { formatDate, formatMoney } from '../../utils/format'
import { toPiastres } from '../../utils/money'
import Form from '../../components/form/Form'

/** Work done and total of a visit (FR-D.2, D.3); the total cannot go below what was paid (PR-2). */
export default function EditVisitModal({ visit, onClose }) {
  const { t } = useTranslation()
  const update = useUpdateVisit()
  const [form, setForm] = useState({ work_done: visit.work_done, total_amount: visit.total_amount })
  const errors = fieldErrors(update.error)
  const formError = update.error && !Object.keys(errors).length ? errorMessage(update.error, t('common.networkError')) : ''

  const total = toPiastres(form.total_amount)
  const belowPaid = total < toPiastres(visit.paid)
  const canSave = form.work_done.trim() !== '' && !Number.isNaN(total) && !belowPaid && !update.isPending

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSave) return
    update.mutate({ id: visit.id, work_done: form.work_done.trim(), total_amount: form.total_amount }, { onSuccess: onClose })
  }

  return (
    <Modal open title={t('visits.editTitle', { date: formatDate(visit.visit_date) })} onClose={onClose}>
      <Form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <TextAreaField
          label={t('visitForm.workDone')}
          rows={4}
          value={form.work_done}
          onChange={(e) => setForm((f) => ({ ...f, work_done: e.target.value }))}
          error={errors.work_done}
          required
        />
        <MoneyField
          label={t('visitForm.total')}
          value={form.total_amount}
          onChange={(total_amount) => setForm((f) => ({ ...f, total_amount }))}
          error={belowPaid ? t('visits.belowPaid', { amount: formatMoney(visit.paid) }) : errors.total_amount}
          hint={t('visits.alreadyPaid', { amount: formatMoney(visit.paid) })}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={!canSave} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
            {update.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
