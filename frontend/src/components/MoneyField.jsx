import { useTranslation } from 'react-i18next'
import Field from './form/Field'

/**
 * EGP amount input: digits with up to two decimals and an "EGP" suffix.
 * The value stays a string ("1500.50") so it is never rounded as a float.
 */
export default function MoneyField({ label, error, hint, className, value, onChange, ...inputProps }) {
  const { t } = useTranslation()

  function handleChange(event) {
    // Accept what a phone keyboard may type: Arabic-Indic digits and the Arabic decimal comma.
    const text = event.target.value
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[٫,]/g, '.')
    if (/^\d*(\.\d{0,2})?$/.test(text)) onChange(text)
  }

  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {({ className: inputClass, ...controlProps }) => (
        <div className="relative" dir="ltr">
          <input
            {...controlProps}
            {...inputProps}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={handleChange}
            className={`${inputClass} pe-14`}
          />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 mt-1 flex items-center text-sm text-slate-500">
            {t('money.egp')}
          </span>
        </div>
      )}
    </Field>
  )
}
