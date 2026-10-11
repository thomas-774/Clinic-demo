import { useId } from 'react'

const inputClass = (error) =>
  `mt-1 block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
    error ? 'border-red-600 focus:ring-red-600' : 'border-slate-500 focus:ring-sky-600'
  }`

/**
 * Label + control + hint/error. `children` receives the props the control
 * needs (id, aria-invalid, aria-describedby, className).
 */
export default function Field({ label, error, hint, className = '', children }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        className: inputClass(error),
      })}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
