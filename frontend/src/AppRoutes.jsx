import { Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from './auth/useAuth'
import GuestRoute from './auth/GuestRoute'
import ProtectedRoute from './auth/ProtectedRoute'
import RoleRoute from './auth/RoleRoute'
import ErrorBoundary from './components/ErrorBoundary'
import FullPageLoader from './components/FullPageLoader'
import OfflineBanner from './components/OfflineBanner'
import RouteChange from './components/RouteChange'
import AssistantLayout from './layouts/AssistantLayout'
import DoctorLayout from './layouts/DoctorLayout'
import PatientLayout from './layouts/PatientLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import {
  AssistantPatientPage,
  AssistantToday,
  BookAppointment,
  Dashboard,
  MyAppointments,
  PatientDetails,
  PatientHome,
  PatientsList,
  PREFETCH_DELAY_MS,
  prefetchRolePages,
  PrescriptionForm,
  PrescriptionPrintPage,
  Reports,
  Schedule,
  Settings,
  VisitForm,
} from './pages/lazyPages'
import Status from './pages/Status'

/** "/" sends each user to their own area, or to the login page. */
function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}

/** Every route from §7.2. Role pages load on demand (lazyPages.js). */
export default function AppRoutes() {
  const { role } = useAuth()
  const { pathname } = useLocation()

  // Logged in (or back with a stored token): fetch the rest of the role's pages
  // once the current page is up, so they don't compete with it on a slow
  // phone network (NFR-P.5, T11-14).
  useEffect(() => {
    if (!role) return
    const timer = setTimeout(() => prefetchRolePages(role), PREFETCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [role])

  return (
    <>
      <OfflineBanner />
      <RouteChange />
      {/* A page that fails to load or crashes shows a way out, not a blank screen (T7-03). */}
      <ErrorBoundary fullPage resetKey={pathname}>
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/status" element={<Status />} />

            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/patient" element={<RoleRoute role="patient" />}>
                <Route element={<PatientLayout />}>
                  <Route index element={<PatientHome />} />
                  <Route path="book" element={<BookAppointment />} />
                  <Route path="appointments" element={<MyAppointments />} />
                </Route>
              </Route>

              <Route path="/doctor" element={<RoleRoute role="doctor" />}>
                <Route element={<DoctorLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="schedule" element={<Schedule />} />
                  <Route path="patients" element={<PatientsList />} />
                  <Route path="patients/:id" element={<PatientDetails />} />
                  <Route path="visits/new" element={<VisitForm />} />
                  <Route path="patients/:id/prescriptions/new" element={<PrescriptionForm />} />
                  <Route path="prescriptions/:id/edit" element={<PrescriptionForm editing />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="reports" element={<Reports />} />
                </Route>
                {/* Print-only page: no sidebar or menus (RX-4). */}
                <Route path="prescriptions/:id/print" element={<PrescriptionPrintPage />} />
              </Route>

              <Route path="/assistant" element={<RoleRoute role="assistant" />}>
                <Route element={<AssistantLayout />}>
                  <Route index element={<AssistantToday />} />
                  <Route path="patients" element={<PatientsList />} />
                  <Route path="patients/:id" element={<AssistantPatientPage />} />
                  <Route path="schedule" element={<Schedule />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
