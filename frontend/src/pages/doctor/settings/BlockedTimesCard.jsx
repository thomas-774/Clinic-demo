import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../../../components/Card'
import ConfirmDialog from '../../../components/ConfirmDialog'
import { LoadError, Loading } from '../../../components/QueryState'
import CheckboxField from '../../../components/form/CheckboxField'
import TextField from '../../../components/form/TextField'
import { useAddBlockedTime, useBlockedTimes, useDeleteBlockedTime } from '../../../hooks/useBlockedTimes'
import { useToast } from '../../../toast/useToast'
import { errorMessage, fieldErrors } from '../../../utils/apiErrors'
import { formatDate, todayInClinic } from '../../../utils/format'
import Form from '../../../components/form/Form'

const emptyForm = () => ({ date: todayInClinic(), whole_day: true, start_time: '', end_time: '', reason: '' })

function AddBlockForm() {
  const { t } = useTranslation()
  const toast = useToast()
  const add = useAddBlockedTime()
  const [form, setForm] = useState(emptyForm)
  const errors = fieldErrors(add.error)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    add.mutate(
      {
        date: form.date,
        start_time: form.whole_day ? null : form.start_time || null,
        end_time: form.whole_day ? null : form.end_time || null,
        reason: form.reason.trim() || null,
      },
      {
        onSuccess: () => {
          setForm(emptyForm())
          toast.success(t('blocked.added'))
        },
        onError: (error) => error?.response?.status !== 422 && toast.error(errorMessage(error, t('common.networkError'))),
      },
    )
  }

  return (
    <Form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">{t('blocked.addTitle')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t('blocked.date')} type="date" min={todayInClinic()} value={form.date} onChange={set('date')} error={errors.date} required />
        <TextField label={t('blocked.reason')} value={form.reason} onChange={set('reason')} error={errors.reason} placeholder={t('blocked.reasonPlaceholder')} />
      </div>
      <CheckboxField
        label={t('blocked.wholeDay')}
        checked={form.whole_day}
        onChange={(event) => setForm((current) => ({ ...current, whole_day: event.target.checked }))}
      />
      {!form.whole_day && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('blocked.from')} type="time" value={form.start_time} onChange={set('start_time')} error={errors.start_time} />
          <TextField label={t('blocked.to')} type="time" value={form.end_time} onChange={set('end_time')} error={errors.end_time} />
        </div>
      )}
      <button type="submit" disabled={add.isPending} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
        {add.isPending ? t('common.saving') : t('blocked.add')}
      </button>
    </Form>
  )
}

/** Holidays and blocked hours (FR-G.3). */
export default function BlockedTimesCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: blocks, isPending, isError, refetch } = useBlockedTimes()
  const remove = useDeleteBlockedTime()
  const [deleting, setDeleting] = useState(null)

  const describe = (block) => (block.whole_day ? t('blocked.wholeDay') : `${block.start_time} – ${block.end_time}`)

  return (
    <Card title={t('blocked.title')}>
      <div className="space-y-4">
        {isPending ? (
          <Loading />
        ) : isError ? (
          <LoadError onRetry={refetch} />
        ) : blocks.length === 0 ? (
          <p className="text-sm text-slate-500">{t('blocked.empty')}</p>
        ) : (
          <ul aria-label={t('blocked.listLabel')} className="divide-y divide-slate-100">
            {blocks.map((block) => (
              <li key={block.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-medium text-slate-900">{formatDate(block.date)}</span>
                <span dir="ltr" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {describe(block)}
                </span>
                {block.reason && <span className="text-sm text-slate-600">{block.reason}</span>}
                <button
                  type="button"
                  onClick={() => setDeleting(block)}
                  aria-label={t('blocked.deleteLabel', { date: formatDate(block.date) })}
                  className="ms-auto rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  {t('patientDetails.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <AddBlockForm />
      </div>
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('blocked.deleteTitle')}
        message={deleting ? t('blocked.deleteMessage', { date: formatDate(deleting.date), when: describe(deleting) }) : ''}
        confirmLabel={t('patientDetails.delete')}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          remove.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null)
              toast.success(t('blocked.removed'))
            },
          })
        }
      />
    </Card>
  )
}
