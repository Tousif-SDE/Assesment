import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useRegisterMutation } from '../../redux/api/authApi'

const Register = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('STUDENT')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const navigate = useNavigate()
  const { userInfo } = useSelector((state) => state.auth)
  const [register, { isLoading }] = useRegisterMutation()

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

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      await register({ name, email, password, role }).unwrap()
      setSuccess(true)
      
      // Clear form
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err?.data?.message || 'Registration failed')
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[80vh]">
      <div className="w-full max-w-md">
        <div className="bg-white p-6 rounded-lg shadow-md auth-container">
          <h2 className="text-2xl font-bold text-center mb-6 text-dark">Register</h2>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">
              <span>Registration successful! Redirecting to login...</span>
            </div>
          )}
          
          <form onSubmit={submitHandler}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                id="name"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

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

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="block text-gray-700 text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="role" className="block text-gray-700 text-sm font-medium mb-2">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
              </select>
            </div>

            <button
              type="submit"
              className={`w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors mt-4 ${(isLoading || success) ? 'opacity-70 cursor-not-allowed' : ''}`}
              disabled={isLoading || success}
            >
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-600">Already have an account?{' '}</span>
            <Link to="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register