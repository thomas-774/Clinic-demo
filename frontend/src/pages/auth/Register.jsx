import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import PasswordField from '../../components/form/PasswordField'
import TextField from '../../components/form/TextField'
import AuthLayout from '../../layouts/AuthLayout'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import Form from '../../components/form/Form'

const EMPTY_FORM = { name: '', phone: '', email: '', password: '', password_confirmation: '', address: '' }

export default function Register() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setFormError('')
    try {
      // GuestRoute moves the new patient on to /patient.
      await register(form)
    } catch (error) {
      const fields = fieldErrors(error)
      setErrors(fields)
      if (!Object.keys(fields).length) {
        setFormError(errorMessage(error, t('common.networkError')))
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.register.title')}
      footer={
        <>
          {t('auth.register.haveAccount')}{' '}
          <Link to="/login" className="inline-flex min-h-11 min-w-11 items-center justify-center font-medium text-sky-700 hover:underline">
            {t('auth.register.logIn')}
          </Link>
        </>
      }
    >
      <Form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <TextField label={t('auth.register.name')} name="name" autoComplete="name" value={form.name} onChange={update('name')} error={errors.name} required />
        <TextField
          label={t('auth.register.phone')}
          name="phone"
          type="tel"
          autoComplete="tel"
          dir="ltr"
          value={form.phone}
          onChange={update('phone')}
          error={errors.phone}
          required
        />
        <TextField
          label={t('auth.register.email')}
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          dir="ltr"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <TextField
          label={t('auth.register.address')}
          name="address"
          autoComplete="street-address"
          value={form.address}
          onChange={update('address')}
          error={errors.address}
          required
        />
        <PasswordField
          label={t('auth.register.password')}
          name="password"
          autoComplete="new-password"
          hint={t('auth.register.passwordHint')}
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          required
        />
        <PasswordField
          label={t('auth.register.confirmPassword')}
          name="password_confirmation"
          autoComplete="new-password"
          value={form.password_confirmation}
          onChange={update('password_confirmation')}
          error={errors.password_confirmation}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full rounded-lg bg-sky-700 px-4 py-2.5 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {submitting ? t('auth.register.submitting') : t('auth.register.submit')}
        </button>
      </Form>
    </AuthLayout>
  )
}
