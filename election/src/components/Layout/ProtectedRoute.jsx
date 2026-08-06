import { Navigate } from 'react-router-dom'
import { useAdmin } from '../../hooks/useAdmin'
import { FullPageLoader } from '../ui/LoadingSpinner'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAdmin()
  if (loading) return <FullPageLoader message="Verifying access…" />
  if (!user) return <Navigate to="/admin" replace />
  return children
}
