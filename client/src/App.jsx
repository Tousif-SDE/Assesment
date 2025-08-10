import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'

// Components
import Header from './components/layout/Header'
import ProtectedRoute from './components/auth/ProtectedRoute'

// Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import CreateRoom from './pages/teacher/CreateRoom'
import TeacherRoom from './pages/teacher/TeacherRoom'
import StudentDashboard from './pages/student/StudentDashboard'
import JoinRoom from './pages/student/JoinRoom'
import StudentRoom from './pages/student/StudentRoom'

// Redux
import { setCredentials, logout } from './redux/slices/authSlice'

function App() {
  const dispatch = useDispatch()
  const { userInfo } = useSelector((state) => state.auth)

  useEffect(() => {
    // Check for token in localStorage on app load
    const token = localStorage.getItem('token')
    const userRole = localStorage.getItem('userRole')
    
    if (token && userRole) {
      dispatch(setCredentials({ token, role: userRole }))
    } else {
      dispatch(logout())
    }
  }, [])

  return (
    <>
      <Header />
      <main className="py-3">
        <div className="container">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
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
              path="/student/" 
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
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
            
            {/* Redirect based on role */}
            <Route 
              path="/" 
              element={
                userInfo ? (
                  userInfo.role === 'TEACHER' ? (
                    <Navigate to="/teacher" replace />
                  ) : (
                    <Navigate to="/student" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
          </Routes>
        </div>
      </main>
    </>
  )
}

export default App