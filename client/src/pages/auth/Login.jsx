import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useLoginMutation } from '../../redux/api/authApi'
import { setCredentials } from '../../redux/slices/authSlice'
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap'
import { Mail, Lock, LogIn } from 'lucide-react'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()
  const { userInfo } = useSelector((state) => state.auth)

  useEffect(() => {
    if (userInfo) {
      navigate(userInfo.role === 'TEACHER' ? '/teacher' : '/student')
    }
  }, [userInfo, navigate])

  const submitHandler = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await login({ email, password }).unwrap()
      dispatch(setCredentials(res))
      navigate(res.role === 'TEACHER' ? '/teacher' : '/student')
    } catch (err) {
      setError(err?.data?.message || 'Login failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #f5f3ff, #ede9fe, #ddd6fe)',
      display: 'flex',
      alignItems: 'center',
      padding: '20px',
      margin: 0,
      position: 'fixed',
      top: 0,
      left: 0,
      overflow: 'auto'
    }}>
      <Container>
        <Row className="justify-content-center">
          <Col md={5} lg={4}>
            <Card style={{
              borderRadius: '24px',
              border: 'none',
              boxShadow: '0 20px 60px rgba(139, 92, 246, 0.15)'
            }}>
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <div style={{
                    background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                    borderRadius: '20px',
                    width: '60px',
                    height: '60px',
                    margin: '0 auto 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <LogIn size={28} color="white" />
                  </div>
                  <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>
                    Welcome Back
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '30px' }}>Sign in to continue</p>
                </div>

                {error && (
                  <Alert variant="danger" style={{ borderRadius: '12px', backgroundColor: '#fef2f2', border: 'none', color: '#dc2626' }}>
                    {error}
                  </Alert>
                )}

                <Form onSubmit={submitHandler}>
                  <Form.Group className="mb-3">
                    <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={16} color="#8b5cf6" /> Email
                    </Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        padding: '12px 16px',
                        fontSize: '16px'
                      }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-4">
                    <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={16} color="#8b5cf6" /> Password
                    </Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        padding: '12px 16px',
                        fontSize: '16px'
                      }}
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-100"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      marginBottom: '20px'
                    }}
                  >
                    {isLoading ? <><Spinner size="sm" className="me-2" />Signing in...</> : 'Sign In'}
                  </Button>
                </Form>

                <div className="text-center">
                  <span style={{ color: '#6b7280' }}>New to Skelo? </span>
                  <Link to="/register" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: '600' }}>
                    Create Account
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default Login