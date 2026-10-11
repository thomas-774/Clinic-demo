import { createElement, lazy, useState } from 'react'

/**
 * Each role's pages are separate chunks (NFR-P.4, T11-10): a patient never
 * downloads the doctor's pages, and Recharts (Reports only) stays out of the
 * first load. Login and Register stay in the main chunk.
 */
/**
 * Remembers the module once its chunk is in, so the page can render it
 * directly. Through React.lazy alone, even an already downloaded page
 * suspends once, and React then holds the page back ~300 ms after the
 * loading screen (Suspense fallback throttling): on a phone that pushed the
 * first real paint (LCP) past budget (NFR-P.5, T11-14).
 */
function remembered(importPage) {
  const load = () =>
    importPage().then((module) => {
      load.module = module
      return module
    })
  return load
}

const shared = {
  PatientsList: remembered(() => import('./doctor/PatientsList')),
  Schedule: remembered(() => import('./doctor/Schedule')),
}

export const loaders = {
  patient: {
    PatientHome: remembered(() => import('./patient/PatientHome')),
    BookAppointment: remembered(() => import('./patient/BookAppointment')),
    MyAppointments: remembered(() => import('./patient/MyAppointments')),
  },
  doctor: {
    Dashboard: remembered(() => import('./doctor/Dashboard')),
    PatientDetails: remembered(() => import('./doctor/PatientDetails')),
    VisitForm: remembered(() => import('./doctor/VisitForm')),
    PrescriptionForm: remembered(() => import('./doctor/PrescriptionForm')),
    PrescriptionPrintPage: remembered(() => import('./doctor/PrescriptionPrintPage')),
    Settings: remembered(() => import('./doctor/Settings')),
    Reports: remembered(() => import('./doctor/Reports')),
    ...shared,
  },
  assistant: {
    AssistantToday: remembered(() => import('./assistant/Today')),
    AssistantPatientPage: remembered(() => import('./assistant/PatientPage')),
    ...shared,
  },
}

/** How long after login AppRoutes waits before prefetchRolePages(). */
export const PREFETCH_DELAY_MS = 1500

/**
 * Starts downloading every page of `role` (right after login), so the first
 * click does not wait for its chunk. A failed download is ignored here;
 * opening the page asks for the chunk again.
 */
export function prefetchRolePages(role) {
  return Promise.all(Object.values(loaders[role] ?? {}).map((load) => load().catch(() => null)))
}

/** A page: rendered directly once its chunk is in, through React.lazy until then. */
function page(load) {
  const Lazy = lazy(load)
  function Page(props) {
    // Chosen once per mount: switching type later would remount the page and lose its state.
    const [Component] = useState(() => load.module?.default ?? Lazy)
    return createElement(Component, props)
  }
  Page.load = load
  return Page
}

export const PatientHome = page(loaders.patient.PatientHome)
export const BookAppointment = page(loaders.patient.BookAppointment)
export const MyAppointments = page(loaders.patient.MyAppointments)

export const Dashboard = page(loaders.doctor.Dashboard)
export const PatientDetails = page(loaders.doctor.PatientDetails)
export const VisitForm = page(loaders.doctor.VisitForm)
export const PrescriptionForm = page(loaders.doctor.PrescriptionForm)
export const PrescriptionPrintPage = page(loaders.doctor.PrescriptionPrintPage)
export const Settings = page(loaders.doctor.Settings)
export const Reports = page(loaders.doctor.Reports)
export const PatientsList = page(shared.PatientsList)
export const Schedule = page(shared.Schedule)

export const AssistantToday = page(loaders.assistant.AssistantToday)
export const AssistantPatientPage = page(loaders.assistant.AssistantPatientPage)
