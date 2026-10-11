import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../../../components/Card'
import ConfirmDialog from '../../../components/ConfirmDialog'
import Modal from '../../../components/Modal'
import { LoadError, Loading } from '../../../components/QueryState'
import TextField from '../../../components/form/TextField'
import { useCreateStaff, useStaff, useUpdateStaff } from '../../../hooks/useStaff'
import { useToast } from '../../../toast/useToast'
import { errorMessage, fieldErrors } from '../../../utils/apiErrors'
import Form from '../../../components/form/Form'

const smallButton = 'rounded-md px-2 py-1 text-xs font-semibold hover:bg-slate-100'

/** The new password, shown once for the doctor to hand over. */
function PasswordOnce({ account, onClose }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
        <p className="text-sm text-amber-900">{t('staff.passwordOnce', { name: account.name })}</p>
        <code dir="ltr" data-testid="staff-password" className="mt-2 inline-block rounded-lg bg-white px-3 py-1.5 text-lg font-bold tracking-widest text-slate-900 ring-1 ring-amber-200">
          {account.initial_password}
        </code>
        <p className="mt-2 text-sm text-amber-900">
          {t('staff.loginWith')} <span dir="ltr" className="font-semibold">{account.phone}</span>
        </p>
      </div>
      <button type="button" onClick={onClose} className="w-full rounded-lg bg-sky-700 px-4 py-2.5 font-semibold text-white hover:bg-sky-800">
        {t('newPatient.done')}
      </button>
    </div>
  )
}

/** Add (account = null) or edit an assistant; adding ends on the password. */
function StaffModal({ account, onClose }) {
  const { t } = useTranslation()
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const save = account ? update : create
  const [form, setForm] = useState({ name: account?.name ?? '', phone: account?.phone ?? '', email: account?.email ?? '' })
  const [created, setCreated] = useState(null)
  const errors = fieldErrors(save.error)
  const formError = save.error && !Object.keys(errors).length ? errorMessage(save.error, t('common.networkError')) : ''
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  function handleSubmit(event) {
    event.preventDefault()
    const fields = { name: form.name, phone: form.phone, email: form.email.trim() || null }
    if (account) update.mutate({ id: account.id, ...fields }, { onSuccess: onClose })
    else create.mutate(fields, { onSuccess: setCreated })
  }

  return (
    <Modal open title={created ? t('staff.createdTitle') : t(account ? 'staff.editTitle' : 'staff.addTitle')} onClose={onClose}>
      {created ? (
        <PasswordOnce account={created} onClose={onClose} />
      ) : (
        <Form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <TextField label={t('patientForm.name')} value={form.name} onChange={set('name')} error={errors.name} required />
          <TextField label={t('patientForm.phone')} type="tel" dir="ltr" value={form.phone} onChange={set('phone')} error={errors.phone} required />
          <TextField label={t('patientForm.email')} type="email" dir="ltr" value={form.email} onChange={set('email')} error={errors.email} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={save.isPending} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
              {save.isPending ? t('common.saving') : t(account ? 'common.save' : 'staff.create')}
            </button>
          </div>
        </Form>
      )}
    </Modal>
  )
}

/**
 * Settings → Staff (FR-I.1): the assistant accounts, with add, edit,
 * activate / deactivate and reset password. Deactivating logs them out.
 */
export default function StaffCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data, isPending, isError, refetch } = useStaff()
  const update = useUpdateStaff()
  const [editing, setEditing] = useState(null) // null = closed, {} = new, account = edit
  const [confirming, setConfirming] = useState(null) // { account, action: 'deactivate' | 'reset' }
  const [reset, setReset] = useState(null) // account with its new password

  const failed = (error) => toast.error(errorMessage(error, t('common.networkError')))

  function activate(account) {
    update.mutate({ id: account.id, is_active: true }, { onSuccess: () => toast.success(t('staff.activated', { name: account.name })), onError: failed })
  }

  function confirm() {
    const { account, action } = confirming
    const fields = action === 'reset' ? { reset_password: true } : { is_active: false }
    update.mutate(
      { id: account.id, ...fields },
      {
        onSuccess: (saved) => {
          if (action === 'reset') setReset(saved)
          else toast.success(t('staff.deactivated', { name: account.name }))
        },
        onError: failed,
        onSettled: () => setConfirming(null),
      },
    )
  }

  return (
    <Card
      title={t('staff.title')}
      action={
        <button type="button" onClick={() => setEditing({})} className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-800">
          {t('staff.add')}
        </button>
      }
    >
      <p className="mb-3 text-sm text-slate-500">{t('staff.hint')}</p>
      {isPending ? (
        <Loading />
      ) : isError ? (
        <LoadError onRetry={refetch} />
      ) : data.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">{t('staff.empty')}</p>
      ) : (
        <ul aria-label={t('staff.title')} className="divide-y divide-slate-100">
          {data.map((account) => (
            <li key={account.id} className={`flex flex-wrap items-center gap-3 py-2 ${account.is_active ? '' : 'opacity-70'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{account.name}</p>
                <p dir="ltr" className="text-sm text-slate-500 rtl:text-end">
                  {account.phone}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${account.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}
              >
                {t(account.is_active ? 'staff.active' : 'staff.inactive')}
              </span>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => setEditing(account)} className={`${smallButton} text-sky-700`} aria-label={t('staff.editLabel', { name: account.name })}>
                  {t('patientDetails.edit')}
                </button>
                <button type="button" onClick={() => setConfirming({ account, action: 'reset' })} className={`${smallButton} text-slate-700`} aria-label={t('staff.resetLabel', { name: account.name })}>
                  {t('staff.reset')}
                </button>
                {account.is_active ? (
                  <button type="button" onClick={() => setConfirming({ account, action: 'deactivate' })} className={`${smallButton} text-red-600`} aria-label={t('staff.deactivateLabel', { name: account.name })}>
                    {t('staff.deactivate')}
                  </button>
                ) : (
                  <button type="button" disabled={update.isPending} onClick={() => activate(account)} className={`${smallButton} text-green-700`} aria-label={t('staff.activateLabel', { name: account.name })}>
                    {t('staff.activate')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <StaffModal account={editing.id ? editing : null} onClose={() => setEditing(null)} />}
      {reset && (
        <Modal open title={t('staff.resetTitle')} onClose={() => setReset(null)}>
          <PasswordOnce account={reset} onClose={() => setReset(null)} />
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming ? t(`staff.confirm.${confirming.action}.title`) : ''}
        message={confirming ? t(`staff.confirm.${confirming.action}.message`, { name: confirming.account.name }) : ''}
        confirmLabel={confirming ? t(`staff.confirm.${confirming.action}.action`) : ''}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
        busy={update.isPending}
      />
    </Card>
  )
}
