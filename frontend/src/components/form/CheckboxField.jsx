import { useId } from 'react'

export default function CheckboxField({ label, hint, className = '', ...inputProps }) {
  const id = useId()

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        id={id}
        type="checkbox"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
        {...inputProps}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
