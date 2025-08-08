import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { userInfo } = useSelector((state) => state.auth)

  // If not logged in, redirect to login
  if (!userInfo) {
    return <Navigate to="/login" replace />
  }

  // If role is not allowed, redirect to appropriate dashboard
  if (allowedRoles && !allowedRoles.includes(userInfo.role)) {
    return userInfo.role === 'TEACHER' ? (
      <Navigate to="/teacher" replace />
    ) : (
      <Navigate to="/student" replace />
    )
  }

  return children
}

export default ProtectedRoute