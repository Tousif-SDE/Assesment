import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useRegisterMutation } from '../../redux/api/authApi'
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap'
import { User, Mail, Lock, Shield, UserPlus } from 'lucide-react'

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
    if (userInfo) {
      navigate(userInfo.role === 'TEACHER' ? '/teacher' : '/student')
    }
  }, [userInfo, navigate])

  const submitHandler = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    try {
      await register({ name, email, password, role }).unwrap()
      setSuccess(true)
      setName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err?.data?.message || 'Registration failed')
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
          <Col md={7} lg={6}>
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
                    <UserPlus size={28} color="white" />
                  </div>
                  <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>
                    Join Skelo
                  </h2>
                  <p style={{ color: '#6b7280', marginBottom: '30px' }}>Create your account</p>
                </div>

                {error && (
                  <Alert variant="danger" style={{ borderRadius: '12px', backgroundColor: '#fef2f2', border: 'none', color: '#dc2626' }}>
                    {error}
                  </Alert>
                )}
                {success && (
                  <Alert variant="success" style={{ borderRadius: '12px', backgroundColor: '#f0fdf4', border: 'none', color: '#16a34a' }}>
                    Success! Redirecting to login...
                  </Alert>
                )}

                <Form onSubmit={submitHandler}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={16} color="#8b5cf6" /> Name
                        </Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          style={{
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            padding: '12px 16px'
                          }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Mail size={16} color="#8b5cf6" /> Email
                        </Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          style={{
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            padding: '12px 16px'
                          }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Lock size={16} color="#8b5cf6" /> Password
                        </Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          style={{
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            padding: '12px 16px'
                          }}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Lock size={16} color="#8b5cf6" /> Confirm
                        </Form.Label>
                        <Form.Control
                          type="password"
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          style={{
                            borderRadius: '12px',
                            border: '2px solid #e5e7eb',
                            padding: '12px 16px'
                          }}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-4">
                    <Form.Label style={{ fontWeight: '600', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Shield size={16} color="#8b5cf6" /> I am a
                    </Form.Label>
                    <Form.Select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #e5e7eb',
                        padding: '12px 16px'
                      }}
                    >
                      <option value="STUDENT">Student</option>
                      <option value="TEACHER">Teacher</option>
                    </Form.Select>
                  </Form.Group>

                  <Button
                    type="submit"
                    disabled={isLoading || success}
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
                    {isLoading ? <><Spinner size="sm" className="me-2" />Creating...</> : 'Create Account'}
                  </Button>
                </Form>

                <div className="text-center">
                  <span style={{ color: '#6b7280' }}>Already have an account? </span>
                  <Link to="/login" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: '600' }}>
                    Sign In
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

export default Register