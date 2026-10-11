import Field from './Field'

/** Labelled input with an optional hint and a server error underneath. */
export default function TextField({ label, error, hint, className, ...inputProps }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(controlProps) => <input {...controlProps} {...inputProps} />}
    </Field>
  )
}
