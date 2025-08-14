import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'

// Components
import ProtectedRoute from './components/auth/ProtectedRoute'

// Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import CreateRoom from './pages/teacher/CreateRoom'
import TeacherRoom from './pages/teacher/TeacherRoom'
import JoinRoom from './pages/student/JoinRoom'
import StudentRoom from './pages/student/StudentRoom'

// Redux
import { setCredentials, logout } from './redux/slices/authSlice'

function App() {
  const dispatch = useDispatch()
  const { userInfo, token } = useSelector((state) => state.auth)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Restore session if token is in localStorage
    const storedToken = localStorage.getItem('token')
    const storedUserRole = localStorage.getItem('userRole')
    const storedUserInfo = localStorage.getItem('userInfo')

    if (storedToken && storedUserRole && storedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(storedUserInfo)
        dispatch(
          setCredentials({
            token: storedToken,
            role: storedUserRole,
            user: parsedUserInfo,
          })
        )
      } catch (error) {
        console.error('Error parsing stored user info:', error)
        // Clear corrupted data
        localStorage.removeItem('token')
        localStorage.removeItem('userRole')
        localStorage.removeItem('userInfo')
        dispatch(logout())
      }
    } else {
      dispatch(logout())
    }

    setIsLoading(false)
  }, [dispatch])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: '100vh' }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <main className="py-3">
      <div className="container">
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              userInfo ? (
                <Navigate
                  to={
                    userInfo.role === 'TEACHER'
                      ? '/teacher'
                      : '/student/join-room'
                  }
                  replace
                />
              ) : (
                <Login />
              )
            }
          />
          <Route
            path="/register"
            element={
              userInfo ? (
                <Navigate
                  to={
                    userInfo.role === 'TEACHER'
                      ? '/teacher'
                      : '/student/join-room'
                  }
                  replace
                />
              ) : (
                <Register />
              )
            }
          />

          {/* Teacher Routes */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={['TEACHER']}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/create-room"
            element={
              <ProtectedRoute allowedRoles={['TEACHER']}>
                <CreateRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/room/:roomId"
            element={
              <ProtectedRoute allowedRoles={['TEACHER']}>
                <TeacherRoom />
              </ProtectedRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student/join-room"
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <JoinRoom />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/room/:roomId"
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <StudentRoom />
              </ProtectedRoute>
            }
          />

          {/* Root Route - Role-based redirect */}
          <Route
            path="/"
            element={
              userInfo && token ? (
                userInfo.role === 'TEACHER' ? (
                  <Navigate to="/teacher" replace />
                ) : userInfo.role === 'STUDENT' ? (
                  <Navigate to="/student/join-room" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Fallback Route */}
          <Route
            path="*"
            element={
              userInfo && token ? (
                userInfo.role === 'TEACHER' ? (
                  <Navigate to="/teacher" replace />
                ) : userInfo.role === 'STUDENT' ? (
                  <Navigate to="/student/join-room" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </div>
    </main>
  )
}

export default App
