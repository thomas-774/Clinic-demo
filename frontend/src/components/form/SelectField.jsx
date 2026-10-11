import Field from './Field'

/** Labelled <select>; `options` is a list of { value, label }. */
export default function SelectField({ label, error, hint, className, options, ...selectProps }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(controlProps) => (
        <select {...controlProps} {...selectProps}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}
