import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Field from './Field'

/**
 * Labelled password input with a Show / Hide button (ASVS 2.1.12), so a
 * patient typing on a phone can check what they typed.
 */
export default function PasswordField({ label, error, hint, className, ...inputProps }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const action = visible ? t('common.hidePassword') : t('common.showPassword')

  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {({ className: inputClassName, ...controlProps }) => (
        <div className="relative">
          <input
            {...controlProps}
            {...inputProps}
            type={visible ? 'text' : 'password'}
            className={`${inputClassName} pe-20`}
          />
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            aria-controls={controlProps.id}
            aria-label={`${action} ${label}`}
            className="absolute inset-y-0 end-0 min-w-11 rounded-e-lg px-3 text-sm font-medium text-sky-700 hover:text-sky-900 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            {action}
          </button>
        </div>
      )}
    </Field>
  )
}
