import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MIN_SEARCH_LENGTH, useDrugSearch } from '../hooks/useDrugs'

/** The trade name with the typed part in bold (case-insensitive); unchanged when only an ingredient matched. */
function MatchedName({ name, query }) {
  const at = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return name
  return (
    <>
      {name.slice(0, at)}
      <strong className="font-bold text-slate-950">{name.slice(at, at + query.length)}</strong>
      {name.slice(at + query.length)}
    </>
  )
}

/**
 * Drug typeahead (§7.3 DrugSearch, FR-J.2): asks /doctor/drugs/search 250 ms
 * after the last keystroke from 2 characters, ↑ ↓ move, Enter picks, Esc
 * closes. Enter never submits the surrounding form. When nothing matches it
 * offers to use the typed name as written.
 *
 * - `onSelect(drug)` — a catalogue drug was picked (a search result).
 * - `onFreeText(name)` — the doctor chose to use the typed name as written.
 * - `onHighlight(drug | null)` — the highlighted result changed, so the side
 *   note can show it before anything is picked.
 * - `onInputChange(text)` — the typed text changed (the form tracks lines
 *   that were typed in but not picked yet).
 */
export default function DrugSearch({
  label,
  initialQuery = '',
  placeholder,
  onSelect,
  onFreeText,
  onHighlight,
  onInputChange,
  inputRef,
  invalid = false,
  describedBy,
}) {
  const { t } = useTranslation()
  const listId = useId()
  const [text, setText] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  // The highlight belongs to one result list; a new query starts again at the first result.
  const [highlight, setHighlight] = useState({ query: '', index: 0 })

  const { drugs, query, enabled, isFetching } = useDrugSearch(text)
  const typed = text.trim()
  const settled = enabled && query === typed && !isFetching
  const offerFreeText = settled && drugs.length === 0

  const options = drugs.length > 0 ? drugs : offerFreeText ? [{ freeText: typed }] : []
  const showList = open && typed.length >= MIN_SEARCH_LENGTH && (options.length > 0 || isFetching)
  const index = highlight.query === query ? Math.min(highlight.index, options.length - 1) : 0
  const active = showList && options.length > 0 ? options[index] : null
  const highlightedDrug = active && !active.freeText ? active : null

  // Tell the parent which drug is highlighted, once per change of drug. The ref
  // holds the latest callback and drug, so the effect is keyed on the id only.
  const highlightedId = highlightedDrug?.id ?? null
  const latest = useRef({ onHighlight, drug: highlightedDrug })
  useEffect(() => {
    latest.current = { onHighlight, drug: highlightedDrug }
  })
  useEffect(() => {
    latest.current.onHighlight?.(latest.current.drug)
  }, [highlightedId])

  const optionId = (i) => `${listId}-option-${i}`

  const pick = (option) => {
    setOpen(false)
    if (option.freeText) {
      onFreeText?.(option.freeText)
    } else {
      setText(option.trade_name)
      onSelect?.(option)
    }
  }

  const move = (step) => {
    if (!showList) {
      setOpen(true)
      return
    }
    if (options.length === 0) return
    setHighlight({ query, index: (index + step + options.length) % options.length })
  }

  const onKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Enter':
        // Picks the highlighted line; on a closed list it must not submit the whole form.
        event.preventDefault()
        if (active) pick(active)
        break
      case 'Escape':
        if (showList) {
          event.preventDefault()
          setOpen(false)
        }
        break
      default:
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label ?? t('drugSearch.label')}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active ? optionId(index) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        dir="auto"
        placeholder={placeholder ?? t('drugSearch.placeholder')}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          onInputChange?.(event.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          invalid ? 'border-red-600 focus:ring-red-600' : 'border-slate-500 focus:ring-sky-600'
        }`}
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('drugSearch.results')}
          // Logical inset: lines up with the input in both RTL and LTR.
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
        >
          {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t('drugSearch.searching')}</li>}
          {options.map((option, i) => (
            <li
              key={option.freeText ? 'free-text' : option.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === index}
              // Picked on press, keeping the focus in the input (a blur would close the
              // list first). Keyboard users pick from the input: ↑ ↓ and Enter.
              onMouseDown={(event) => {
                event.preventDefault()
                pick(option)
              }}
              onMouseEnter={() => setHighlight({ query, index: i })}
              className={`cursor-pointer px-3 py-2 text-sm ${i === index ? 'bg-blue-50' : ''}`}
            >
              {option.freeText ? (
                <span>
                  {t('drugSearch.useAsWritten')} <bdi className="font-semibold">“{option.freeText}”</bdi>
                  <span className="block text-xs text-slate-500">{t('drugSearch.noMatch')}</span>
                </span>
              ) : (
                <>
                  <span dir="auto" className="block text-slate-800">
                    <MatchedName name={option.trade_name} query={query} />
                  </span>
                  <span dir="auto" className="block text-xs text-slate-500">
                    {[option.form, option.pack].filter(Boolean).join(' · ')}
                  </span>
                  {option.short_use && (
                    <span dir="auto" className="block truncate text-xs text-slate-500">
                      {option.short_use}
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
