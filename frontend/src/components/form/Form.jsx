import { useEffect, useRef } from 'react'

/** How long after a submit a server's 422 may still move the focus. */
const WAIT_MS = 15000

const firstInvalid = (form) => form.querySelector('[aria-invalid="true"]')

/**
 * `<form noValidate>` that, after a submit, moves the focus to the first field
 * marked `aria-invalid` (NFR-U.1): at once for errors found in the browser,
 * or when the server's errors arrive. Fields get `aria-invalid` and
 * `aria-describedby` from <Field> (or set them themselves).
 */
export default function Form({ onSubmit, children, ...props }) {
  const ref = useRef(null)
  const waitingUntil = useRef(0)

  useEffect(() => {
    const form = ref.current
    const observer = new MutationObserver(() => {
      if (Date.now() > waitingUntil.current) return
      const field = firstInvalid(form)
      if (field) {
        waitingUntil.current = 0
        field.focus()
      }
    })
    observer.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-invalid'] })
    return () => observer.disconnect()
  }, [])

  const handleSubmit = (event) => {
    waitingUntil.current = Date.now() + WAIT_MS
    onSubmit?.(event)
    // Errors that were already showing (and so cause no DOM change) still get the focus.
    requestAnimationFrame(() => {
      const form = ref.current
      const field = form && Date.now() <= waitingUntil.current && firstInvalid(form)
      if (field) {
        waitingUntil.current = 0
        field.focus()
      }
    })
  }

  return (
    <form ref={ref} noValidate onSubmit={handleSubmit} {...props}>
      {children}
    </form>
  )
}
