import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../../redux/slices/authSlice'
import { useLogoutMutation } from '../../redux/api/authApi'

const Header = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { userInfo } = useSelector((state) => state.auth)
  const [logoutApi] = useLogoutMutation()

  const logoutHandler = async () => {
    try {
      // Call the server-side logout endpoint
      await logoutApi().unwrap()
      // Then clear the local state
      dispatch(logout())
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      // Still clear local state even if server logout fails
      dispatch(logout())
      navigate('/login')
    }
  }

  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  return (
    <header className="bg-dark text-white shadow-md">
      <nav className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-primary">Live Coding Classroom</Link>
          
          {/* Mobile menu button */}
          <button 
            className="md:hidden focus:outline-none" 
            onClick={toggleMenu}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          
          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            {userInfo ? (
              <>
                {userInfo.role === 'TEACHER' ? (
                  <>
                    <Link to="/teacher" className="hover:text-primary transition-colors">Dashboard</Link>
                    <Link to="/teacher/create-room" className="hover:text-primary transition-colors">Create Room</Link>
                  </>
                ) : (
                  <>
                    <Link to="/student" className="hover:text-primary transition-colors">Dashboard</Link>
                    <Link to="/student/join-room" className="hover:text-primary transition-colors">Join Room</Link>
                  </>
                )}
                <button 
                  className="ml-4 px-4 py-2 border border-white rounded hover:bg-white hover:text-dark transition-colors" 
                  onClick={logoutHandler}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-primary transition-colors">Login</Link>
                <Link to="/register" className="hover:text-primary transition-colors">Register</Link>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden mt-4 space-y-3 pb-3">
            {userInfo ? (
              <>
                {userInfo.role === 'TEACHER' ? (
                  <>
                    <Link to="/teacher" className="block hover:text-primary transition-colors">Dashboard</Link>
                    <Link to="/teacher/create-room" className="block hover:text-primary transition-colors">Create Room</Link>
                  </>
                ) : (
                  <>
                    <Link to="/student" className="block hover:text-primary transition-colors">Dashboard</Link>
                    <Link to="/student/join-room" className="block hover:text-primary transition-colors">Join Room</Link>
                  </>
                )}
                <button 
                  className="mt-2 w-full px-4 py-2 border border-white rounded hover:bg-white hover:text-dark transition-colors" 
                  onClick={logoutHandler}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block hover:text-primary transition-colors">Login</Link>
                <Link to="/register" className="block hover:text-primary transition-colors">Register</Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  )
}

export default Header