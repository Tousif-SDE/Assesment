import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Button, Alert, Spinner, Badge, Container } from 'react-bootstrap'
import { useGetSubmissionsByStudentQuery } from '../../redux/api/codeApi'
import useSocket from '../../hooks/useSocket'

const StudentDashboard = () => {
  const {
    data: submissions,
    error,
    isLoading,
    refetch,
  } = useGetSubmissionsByStudentQuery()
  
  // Initialize socket connection without a specific room
  const { socket, isConnected } = useSocket()
  
  // State to track real-time statistics
  const [realtimeStats, setRealtimeStats] = useState(null)

  useEffect(() => {
    // Refetch submissions when component mounts
    refetch()
  }, [refetch])
  
  // Listen for progress updates
  useEffect(() => {
    if (socket) {
      const handleProgressUpdate = (data) => {
        console.log('Progress update received:', data)
        if (data.stats) {
          setRealtimeStats(data.stats)
          // Refetch submissions to get the latest data
          refetch()
        }
      }
      
      // Listen for progress-update events
      window.addEventListener('progress-update', handleProgressUpdate)
      
      return () => {
        window.removeEventListener('progress-update', handleProgressUpdate)
      }
    }
  }, [socket, refetch])

  // Process submissions data to get statistics
  const getStatistics = () => {
    // If we have real-time statistics from socket updates, use those
    if (realtimeStats) {
      return {
        totalActive: realtimeStats.total || 0,
        totalAttempted: realtimeStats.attempted || 0,
        totalSolved: realtimeStats.solved || 0
      }
    }
    
    // Otherwise, calculate from submissions data
    if (!submissions || !Array.isArray(submissions)) {
      return { totalActive: 0, totalAttempted: 0, totalSolved: 0 }
    }

    // Get unique test cases attempted
    const uniqueTestCases = new Set(submissions.map(s => s.testCaseId))
    
    // Get solved test cases
    const solvedTestCases = new Set(
      submissions.filter(s => s.status === 'Solved').map(s => s.testCaseId)
    )

    // Get total active test cases (this might need to come from a different endpoint)
    // For now, we'll use attempted + some buffer or you might need to fetch from rooms
    const totalActive = uniqueTestCases.size

    return {
      totalActive,
      totalAttempted: uniqueTestCases.size,
      totalSolved: solvedTestCases.size
    }
  }

  const statistics = getStatistics()

  // Get recent submissions (limit to 6 most recent)
  const getRecentSubmissions = () => {
    if (!submissions || !Array.isArray(submissions)) return []
    
    return submissions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6)
  }

  const recentSubmissions = getRecentSubmissions()

  return (
    <div 
      className="min-vh-100"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <Container fluid className="py-4">
        {/* Header Section */}
        <Row className="align-items-center mb-5">
          <Col>
            <div className="d-flex align-items-center">
              {/* Skelo Brand */}
              <div 
                className="d-inline-block px-3 py-1 rounded-pill text-white fw-semibold me-3"
                style={{
                  background: 'linear-gradient(45deg, #8b5cf6, #a855f7)',
                  fontSize: '0.875rem',
                  letterSpacing: '0.5px'
                }}
              >
                skelo
              </div>
              <div>
                <h4 
                  className="mb-1 fw-bold"
                  style={{
                    color: '#1e293b',
                    fontSize: '1.75rem',
                    letterSpacing: '-0.025em'
                  }}
                >
                  Student Dashboard
                </h4>
                <p 
                  className="mb-0"
                  style={{
                    color: '#64748b',
                    fontSize: '1rem'
                  }}
                >
                  Track your progress and join coding sessions
                </p>
              </div>
            </div>
          </Col>
          <Col className="text-end">
            <Link to="/student/join-room" className="text-decoration-none">
              <Button 
                className="border-0 px-4 py-2 fw-semibold"
                style={{
                  borderRadius: '25px',
                  background: 'linear-gradient(45deg, #fbbf24, #f59e0b)',
                  fontSize: '1rem',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 15px rgba(251, 191, 36, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 25px rgba(251, 191, 36, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(251, 191, 36, 0.3)';
                }}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Join Room
              </Button>
            </Link>
          </Col>
        </Row>

        {isLoading ? (
          <div className="text-center py-5">
            <div 
              className="d-inline-flex align-items-center px-4 py-3 rounded-pill"
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
              }}
            >
              <Spinner 
                animation="border" 
                className="me-3"
                style={{
                  color: '#8b5cf6',
                  width: '1.5rem',
                  height: '1.5rem'
                }}
              />
              <span 
                className="fw-medium"
                style={{ color: '#64748b' }}
              >
                Loading your progress...
              </span>
            </div>
          </div>
        ) : error ? (
          <Alert 
            className="border-0 mb-4"
            style={{
              borderRadius: '15px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <div className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error?.data?.message || 'Failed to load submissions'}
            </div>
          </Alert>
        ) : (
          <>
            {/* Statistics Cards */}
            <Row className="mb-5 g-4">
              <Col md={4}>
                <Card 
                  className="border-0 h-100"
                  style={{
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Card.Body className="text-center text-white p-4">
                    <div className="mb-2">
                      <i 
                        className="bi bi-lightning-charge-fill"
                        style={{ fontSize: '2.5rem', opacity: 0.9 }}
                      ></i>
                    </div>
                    <h3 
                      className="mb-2 fw-bold"
                      style={{ fontSize: '2.5rem' }}
                    >
                      {statistics.totalActive}
                    </h3>
                    <p className="mb-1 fw-medium">Active Test Cases</p>
                    <small 
                      style={{ opacity: 0.8, fontSize: '0.8rem' }}
                    >
                      (Last {submissions?.activeTimeWindowMinutes || 30} min)
                    </small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card 
                  className="border-0 h-100"
                  style={{
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 10px 30px rgba(245, 158, 11, 0.3)',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Card.Body className="text-center text-white p-4">
                    <div className="mb-2">
                      <i 
                        className="bi bi-play-circle-fill"
                        style={{ fontSize: '2.5rem', opacity: 0.9 }}
                      ></i>
                    </div>
                    <h3 
                      className="mb-2 fw-bold"
                      style={{ fontSize: '2.5rem' }}
                    >
                      {statistics.totalAttempted}
                    </h3>
                    <p className="mb-0 fw-medium">Attempted</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4}>
                <Card 
                  className="border-0 h-100"
                  style={{
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Card.Body className="text-center text-white p-4">
                    <div className="mb-2">
                      <i 
                        className="bi bi-check-circle-fill"
                        style={{ fontSize: '2.5rem', opacity: 0.9 }}
                      ></i>
                    </div>
                    <h3 
                      className="mb-2 fw-bold"
                      style={{ fontSize: '2.5rem' }}
                    >
                      {statistics.totalSolved}
                    </h3>
                    <p className="mb-0 fw-medium">Solved</p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Recent Submissions Section */}
            <div className="mb-4">
              <div className="d-flex align-items-center mb-4">
                <h5 
                  className="mb-0 fw-bold"
                  style={{
                    color: '#1e293b',
                    fontSize: '1.5rem'
                  }}
                >
                  Recent Submissions
                </h5>
                <div 
                  className="ms-3 px-2 py-1 rounded-pill"
                  style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8b5cf6',
                    fontSize: '0.8rem',
                    fontWeight: '600'
                  }}
                >
                  {recentSubmissions.length} submissions
                </div>
              </div>
              
              {recentSubmissions.length === 0 ? (
                <Card 
                  className="border-0 text-center"
                  style={{
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <Card.Body className="py-5">
                    <div className="mb-4">
                      <i 
                        className="bi bi-code-slash"
                        style={{
                          fontSize: '4rem',
                          color: '#cbd5e1'
                        }}
                      ></i>
                    </div>
                    <h6 
                      className="mb-2 fw-bold"
                      style={{ color: '#64748b' }}
                    >
                      No submissions yet
                    </h6>
                    <p 
                      className="mb-4"
                      style={{ color: '#94a3b8' }}
                    >
                      You haven't made any submissions yet.<br/>
                      Click the "Join Room" button to get started.
                    </p>
                    <Link to="/student/join-room" className="text-decoration-none">
                      <Button 
                        className="border-0 px-4 py-2 fw-semibold"
                        style={{
                          borderRadius: '20px',
                          background: 'linear-gradient(45deg, #8b5cf6, #a855f7)',
                          fontSize: '0.9rem',
                          letterSpacing: '0.5px',
                          boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
                        }}
                      >
                        <i className="bi bi-plus-circle me-2"></i>
                        Start Coding
                      </Button>
                    </Link>
                  </Card.Body>
                </Card>
              ) : (
                <Row className="g-4">
                  {recentSubmissions.map((submission) => (
                    <Col key={submission.id} md={6} className="mb-4">
                      <Card 
                        className="border-0 h-100"
                        style={{
                          borderRadius: '20px',
                          background: 'rgba(255, 255, 255, 0.9)',
                          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.08)',
                          backdropFilter: 'blur(10px)',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-5px)';
                          e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.08)';
                        }}
                      >
                        <Card.Body className="p-4">
                          <div className="d-flex justify-content-between align-items-start mb-3">
                            <h6 
                              className="mb-0 fw-bold"
                              style={{
                                color: '#1e293b',
                                fontSize: '1.1rem'
                              }}
                            >
                              {submission?.testcase?.title || 
                                (submission?.testcase?.id
                                  ? `Test Case #${submission.testcase.id.substring(0, 8)}`
                                  : 'Untitled Test Case')}
                            </h6>
                            <Badge 
                              className="border-0 px-3 py-2"
                              style={{
                                borderRadius: '20px',
                                background: submission.status === 'Solved' 
                                  ? 'linear-gradient(45deg, #10b981, #059669)' 
                                  : 'linear-gradient(45deg, #ef4444, #dc2626)',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                letterSpacing: '0.5px'
                              }}
                            >
                              {submission.status === 'Solved' ? (
                                <>
                                  <i className="bi bi-check-circle-fill me-1"></i>
                                  SOLVED
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-x-circle-fill me-1"></i>
                                  FAILED
                                </>
                              )}
                            </Badge>
                          </div>
                          
                          <Card.Text>
                            <div className="mb-3">
                              <span 
                                className="fw-medium mb-2 d-block"
                                style={{ 
                                  color: '#64748b',
                                  fontSize: '0.9rem'
                                }}
                              >
                                Input:
                              </span>
                              <div 
                                className="p-3 rounded"
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '0.85rem',
                                  fontFamily: 'Monaco, Consolas, monospace',
                                  color: '#374151',
                                  maxHeight: '100px',
                                  overflowY: 'auto'
                                }}
                              >
                                {submission?.testcase?.input || 'No input available'}
                              </div>
                            </div>
                            
                            <div className="mb-3">
                              <span 
                                className="fw-medium mb-2 d-block"
                                style={{ 
                                  color: '#64748b',
                                  fontSize: '0.9rem'
                                }}
                              >
                                Your Output:
                              </span>
                              <div 
                                className="p-3 rounded"
                                style={{
                                  background: submission.status === 'Solved' ? '#f0fdf4' : '#fef2f2',
                                  border: submission.status === 'Solved' 
                                    ? '1px solid #bbf7d0' 
                                    : '1px solid #fecaca',
                                  fontSize: '0.85rem',
                                  fontFamily: 'Monaco, Consolas, monospace',
                                  color: submission.status === 'Solved' ? '#166534' : '#991b1b',
                                  maxHeight: '100px',
                                  overflowY: 'auto'
                                }}
                              >
                                {submission?.output || 'No output available'}
                              </div>
                            </div>
                            
                            <div className="mb-0">
                              <span 
                                className="fw-medium mb-2 d-block"
                                style={{ 
                                  color: '#64748b',
                                  fontSize: '0.9rem'
                                }}
                              >
                                Expected Output:
                              </span>
                              <div 
                                className="p-3 rounded"
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '0.85rem',
                                  fontFamily: 'Monaco, Consolas, monospace',
                                  color: '#374151',
                                  maxHeight: '100px',
                                  overflowY: 'auto'
                                }}
                              >
                                {submission?.testcase?.expectedOutput || 'No expected output'}
                              </div>
                            </div>
                          </Card.Text>
                        </Card.Body>
                        
                        <div 
                          className="px-4 py-3 border-top-0"
                          style={{
                            background: 'rgba(248, 250, 252, 0.8)',
                            borderBottomLeftRadius: '20px',
                            borderBottomRightRadius: '20px'
                          }}
                        >
                          <small 
                            className="d-flex align-items-center"
                            style={{ color: '#94a3b8' }}
                          >
                            <i className="bi bi-clock me-2"></i>
                            Submitted on {submission?.createdAt ? new Date(submission.createdAt).toLocaleString() : 'Unknown date'}
                          </small>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          </>
        )}
      </Container>
    </div>
  )
}

export default StudentDashboard