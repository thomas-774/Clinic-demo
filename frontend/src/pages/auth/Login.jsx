import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import PasswordField from '../../components/form/PasswordField'
import TextField from '../../components/form/TextField'
import AuthLayout from '../../layouts/AuthLayout'
import { errorMessage, fieldErrors } from '../../utils/apiErrors'
import Form from '../../components/form/Form'

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [form, setForm] = useState({ login: '', password: '' })
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
      // GuestRoute moves the logged-in user on to their area.
      await login(form)
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
      title={t('auth.login.title')}
      footer={
        <>
          {t('auth.login.newPatient')}{' '}
          <Link to="/register" className="inline-flex min-h-11 min-w-11 items-center justify-center font-medium text-sky-700 hover:underline">
            {t('auth.login.createAccount')}
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
        <TextField
          label={t('auth.login.loginField')}
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          value={form.login}
          onChange={update('login')}
          error={errors.login}
          required
        />
        <PasswordField
          label={t('auth.login.password')}
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 w-full rounded-lg bg-sky-700 px-4 py-2.5 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
        >
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </button>
      </Form>
    </AuthLayout>
  )
}
