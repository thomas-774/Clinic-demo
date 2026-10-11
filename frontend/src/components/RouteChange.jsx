import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { matchPath, useLocation } from 'react-router-dom'

/** Page name per route (§7.2), for the browser tab and screen readers. */
const TITLES = [
  ['/login', 'auth.login.title'],
  ['/register', 'auth.register.title'],
  ['/status', 'status.title'],
  ['/patient', 'pages.patientHome'],
  ['/patient/book', 'pages.bookAppointment'],
  ['/patient/appointments', 'pages.myAppointments'],
  ['/doctor', 'pages.dashboard'],
  ['/doctor/schedule', 'pages.schedule'],
  ['/doctor/patients', 'pages.patients'],
  ['/doctor/patients/:id', 'pages.patientDetails'],
  ['/doctor/visits/new', 'pages.visitForm'],
  ['/doctor/patients/:id/prescriptions/new', 'pages.newPrescription'],
  ['/doctor/prescriptions/:id/edit', 'pages.editPrescription'],
  ['/doctor/prescriptions/:id/print', 'pages.printPrescription'],
  ['/doctor/settings', 'pages.settings'],
  ['/doctor/reports', 'pages.reports'],
  ['/assistant', 'pages.today'],
  ['/assistant/patients', 'pages.patients'],
  ['/assistant/patients/:id', 'pages.patientDetails'],
  ['/assistant/schedule', 'pages.schedule'],
]

/** Wait this long for a lazily loaded page to show its heading. */
const HEADING_WAIT_MS = 5000

function titleKeyFor(pathname) {
  return TITLES.find(([pattern]) => matchPath(pattern, pathname))?.[1] ?? null
}

/** Moves focus to the page's <h1> (made focusable), once it is on screen. */
function focusHeadingWhenShown() {
  const tryFocus = () => {
    const heading = document.querySelector('main h1') ?? document.querySelector('h1')
    if (!heading) return false
    // A page that put the focus in one of its fields keeps it.
    if (document.activeElement?.closest?.('main') && document.activeElement.matches('input, select, textarea')) return true
    heading.setAttribute('tabindex', '-1')
    heading.focus()
    return true
  }
  if (tryFocus()) return () => {}

  const observer = new MutationObserver(() => tryFocus() && stop())
  const timer = setTimeout(() => stop(), HEADING_WAIT_MS)
  const stop = () => {
    observer.disconnect()
    clearTimeout(timer)
  }
  observer.observe(document.body, { childList: true, subtree: true })
  return stop
}

/**
 * On every route (NFR-U.1): the page name in <title>, in the current
 * language; after a navigation (not the first load) the focus moves to the
 * new page's heading, so keyboard and screen reader users start there.
 */
export default function RouteChange() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const firstPath = useRef(pathname)

  const key = titleKeyFor(pathname)
  useEffect(() => {
    document.title = key ? `${t(key)} · ${t('common.appName')}` : t('common.appName')
  }, [key, t, i18n.language])

  useEffect(() => {
    if (pathname === firstPath.current) return undefined
    firstPath.current = null
    return focusHeadingWhenShown()
  }, [pathname])

  return null
}
