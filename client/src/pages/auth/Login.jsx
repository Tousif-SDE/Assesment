import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useLoginMutation } from '../../redux/api/authApi'
import { setCredentials } from '../../redux/slices/authSlice'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [login, { isLoading }] = useLoginMutation()
  const { userInfo } = useSelector((state) => state.auth)

  useEffect(() => {
    // If already logged in, redirect to appropriate dashboard
    if (userInfo) {
      if (userInfo.role === 'TEACHER') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    }
  }, [userInfo, navigate])

  const submitHandler = async (e) => {
    e.preventDefault()
    setError(null)

    try {
      const res = await login({ email, password }).unwrap()
      dispatch(setCredentials(res))

      // Redirect based on role
      if (res.role === 'TEACHER') {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (err) {
      setError(err?.data?.message || 'An error occurred during login')
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[80vh]">
      <div className="w-full max-w-md">
        <div className="bg-white p-6 rounded-lg shadow-md auth-container">
          <h2 className="text-2xl font-bold text-center mb-6 text-dark">Sign In</h2>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
              <span>{error}</span>
            </div>
          )}
          
          <form onSubmit={submitHandler}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">Email Address</label>
              <input
                type="email"
                id="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              className={`w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors mt-4 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-600">New User?{' '}</span>
            <Link to="/register" className="text-primary hover:underline">
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login