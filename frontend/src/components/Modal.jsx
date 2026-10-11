import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible dialog: closes on Escape or the backdrop, moves focus inside on
 * open, keeps Tab and Shift+Tab inside while open (NFR-U.1), and puts focus
 * back where it was on close.
 */
export default function Modal({ open, title, onClose, children, size = 'md' }) {
  const { t } = useTranslation()
  const titleId = useId()
  const panelRef = useRef(null)
  // Latest onClose without re-running the focus effect on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const first = panelRef.current?.querySelector('input, select, textarea, button:not([data-close])')
    ;(first ?? panelRef.current)?.focus()

    const onKey = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      // Focus trap: from the last element Tab wraps to the first, and back.
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const [firstItem, lastItem] = [items[0], items[items.length - 1]]
      const inside = panelRef.current.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === firstItem || !inside)) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && (document.activeElement === lastItem || !inside)) {
        event.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    // The backdrop is for the mouse only; keyboard users close with Escape or the × button.
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label={t('common.close')}
            className="-m-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
