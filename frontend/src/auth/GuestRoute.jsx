import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { landingPathFor, useAuth } from './useAuth'
import FullPageLoader from '../components/FullPageLoader'

/**
 * For /login and /register: a logged-in user goes on to their area. This is
 * also what moves the user on right after a successful login or sign-up.
 */
export default function GuestRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (user) return <Navigate to={landingPathFor(user, location.state?.from?.pathname)} replace />

  return <Outlet />
}
