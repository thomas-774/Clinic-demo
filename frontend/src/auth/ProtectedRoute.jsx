import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import FullPageLoader from '../components/FullPageLoader'

/** Lets only logged-in users through; others go to /login and come back after. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}
