import Field from './Field'

export default function TextAreaField({ label, error, hint, className, rows = 3, ...textareaProps }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(controlProps) => <textarea rows={rows} {...controlProps} {...textareaProps} />}
    </Field>
  )
}
