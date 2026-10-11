import { Navigate, Outlet } from 'react-router-dom'
import { homePathFor, useAuth } from './useAuth'

/** Allows only `role`; anyone else is sent to their own home. Use inside ProtectedRoute. */
export default function RoleRoute({ role }) {
  const { user } = useAuth()

  if (user?.role !== role) return <Navigate to={homePathFor(user?.role)} replace />

  return <Outlet />
}
