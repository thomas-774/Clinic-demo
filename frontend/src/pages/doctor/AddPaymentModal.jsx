import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../../components/Modal'
import MoneyField from '../../components/MoneyField'
import SelectField from '../../components/form/SelectField'
import { useStaffApi } from '../../staff/staffApi'
import { useToast } from '../../toast/useToast'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import { formatDate, formatMoney } from '../../utils/format'
import { PAYMENT_METHODS, toPiastres } from '../../utils/money'
import Form from '../../components/form/Form'

/**
 * An installment on a visit (FR-D.6), or the assistant collecting at the desk
 * (FR-I.4); the amount starts at what remains. `title` overrides the heading.
 */
export default function AddPaymentModal({ visit, onClose, title }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { useAddPayment } = useStaffApi()
  const add = useAddPayment()
  const [form, setForm] = useState({ amount: visit.remaining, method: 'cash' })
  const errors = fieldErrors(add.error)
  const formError = add.error && !Object.keys(errors).length ? errorMessage(add.error, t('common.networkError')) : ''

  const amount = toPiastres(form.amount)
  const tooMuch = amount > toPiastres(visit.remaining)
  const canSave = amount > 0 && !tooMuch && !add.isPending

  function handleSubmit(event) {
    event.preventDefault()
    if (!canSave) return
    add.mutate(
      { visitId: visit.id, amount: form.amount, method: form.method },
      {
        onSuccess: (updated) => {
          toast.success(t('visits.paymentSaved', { remaining: formatMoney(updated.remaining) }))
          onClose()
        },
      },
    )
  }

  return (
    <Modal open title={title ?? t('visits.addPaymentTitle', { date: formatDate(visit.visit_date) })} onClose={onClose}>
      <Form onSubmit={handleSubmit} className="space-y-3">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <p className="text-sm text-slate-600">{t('visits.remainingNow', { amount: formatMoney(visit.remaining) })}</p>
        <MoneyField
          label={t('visits.amount')}
          value={form.amount}
          onChange={(amount) => setForm((f) => ({ ...f, amount }))}
          error={tooMuch ? t('visits.tooMuch', { amount: formatMoney(visit.remaining) }) : errors.amount}
          required
        />
        <SelectField
          label={t('visitForm.method')}
          value={form.method}
          onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
          options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`paymentMethod.${m}`) }))}
          error={errors.method}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={!canSave} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
            {add.isPending ? t('common.saving') : t('visits.savePayment')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
