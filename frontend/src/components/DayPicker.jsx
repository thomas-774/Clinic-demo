import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { dateRange } from '../utils/dates'
import { dayParts } from '../utils/format'

/**
 * One chip per bookable day, in a row that scrolls sideways inside its own
 * box on a phone (NFR-U.2). A radio group: one Tab stop, the arrow keys move
 * between days (mirrored in RTL), Home / End jump to the first / last day.
 */
export default function DayPicker({ label, hint, from, count, value, onChange }) {
  const { i18n } = useTranslation()
  const labelId = useId()
  const hintId = useId()
  const days = dateRange(from, count)
  const rowRef = useRef(null)
  const selectedIndex = Math.max(days.indexOf(value), 0)

  function onKeyDown(event) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[event.key]
    let next
    if (step) next = Math.min(Math.max(selectedIndex + step, 0), days.length - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = days.length - 1
    else return
    event.preventDefault()
    onChange(days[next])
    // focus() also scrolls the day into view inside the row.
    rowRef.current?.querySelectorAll('[role=radio]')[next]?.focus()
  }

  return (
    <div>
      <p id={labelId} className="text-sm font-medium text-slate-700">
        {label}
      </p>
      <div
        ref={rowRef}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className="-mx-1 mt-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2"
      >
        {days.map((day, index) => {
          const { weekday, day: number, month } = dayParts(day, i18n.resolvedLanguage)
          const checked = index === selectedIndex
          return (
            <button
              key={day}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(day)}
              onKeyDown={onKeyDown}
              className={`flex min-h-16 min-w-16 shrink-0 snap-start flex-col items-center justify-center rounded-xl px-2 py-1.5 ring-1 transition ${
                checked ? 'bg-sky-700 text-white ring-sky-700' : 'bg-white text-slate-700 ring-slate-300 hover:bg-sky-50'
              }`}
            >
              {/* The spaces keep the name "Mon 5 Oct"; a flex column ignores them. */}
              <span className="text-xs">{weekday}</span>{' '}
              <span className="text-lg font-bold leading-tight">{number}</span>{' '}
              <span className="text-xs">{month}</span>
            </button>
          )
        })}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  )
}
