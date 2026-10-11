import { getMyAppointments } from '../api/appointments'
import { getProfile } from '../api/patient'
import { getSlots } from '../api/slots'
import { myAppointmentsKey } from '../hooks/useAppointments'
import { profileKey } from '../hooks/useProfile'
import { todayInClinic } from '../utils/format'
import { loaders } from './lazyPages'

/**
 * What each patient page needs before it can paint: its chunk and its data.
 * Keys and fetchers are the ones the pages' hooks use, so the hooks find the
 * data in the cache.
 */
const PATIENT_PAGES = {
  '/patient': { page: loaders.patient.PatientHome, data: () => [[profileKey, getProfile]] },
  '/patient/book': {
    page: loaders.patient.BookAppointment,
    data: () => {
      const today = todayInClinic()
      return [[['slots', today], () => getSlots(today)]]
    },
  },
  '/patient/appointments': { page: loaders.patient.MyAppointments, data: () => [[myAppointmentsKey, getMyAppointments]] },
}

/**
 * Opening a patient page with a stored token (NFR-P.5, T11-14): start its
 * chunk and its data together with /me instead of one after the other, which
 * on a slow phone network saves two round trips before the first paint.
 * A failure here is harmless: the page asks again when it mounts.
 */
export function warmStart(pathname, queryClient) {
  const entry = PATIENT_PAGES[pathname.replace(/\/+$/, '') || '/']
  if (!entry) return false
  entry.page().catch(() => null)
  for (const [queryKey, queryFn] of entry.data()) queryClient.prefetchQuery({ queryKey, queryFn })
  return true
}
