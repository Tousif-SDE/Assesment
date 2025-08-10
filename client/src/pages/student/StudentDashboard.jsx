import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Button, Alert, Spinner, Badge, Container } from 'react-bootstrap'
import { useGetSubmissionsByStudentQuery } from '../../redux/api/codeApi'

const StudentDashboard = () => {
  const {
    data: submissions,
    error,
    isLoading,
    refetch,
  } = useGetSubmissionsByStudentQuery()

  useEffect(() => {
    // Refetch submissions when component mounts
    refetch()
  }, [refetch])

  // Process submissions data to get statistics
  const getStatistics = () => {
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
    <Container fluid className="py-4">
      <Row className="align-items-center mb-4">
        <Col>
          <h4 className="text-secondary">Student Dashboard</h4>
        </Col>
        <Col className="text-end">
          <Link to="/student/join-room">
            <Button variant="warning" className="rounded-pill px-4">
              Join Room
            </Button>
          </Link>
        </Col>
      </Row>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="secondary" />
        </div>
      ) : error ? (
        <Alert variant="danger">
          {error?.data?.message || 'Failed to load submissions'}
        </Alert>
      ) : (
        <>
          <Row className="mb-4">
            <Col md={4}>
              <Card className="text-center border-0 shadow-sm">
                <Card.Body>
                  <h3 className="text-primary">{statistics.totalActive}</h3>
                  <p className="text-muted mb-0">Active Test Cases</p>
                  <small className="text-muted">(Last {submissions?.activeTimeWindowMinutes || 30} min)</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center border-0 shadow-sm">
                <Card.Body>
                  <h3 className="text-warning">{statistics.totalAttempted}</h3>
                  <p className="text-muted mb-0">Attempted</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center border-0 shadow-sm">
                <Card.Body>
                  <h3 className="text-success">{statistics.totalSolved}</h3>
                  <p className="text-muted mb-0">Solved</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <h5 className="text-secondary mb-3">Recent Submissions</h5>
          
          {recentSubmissions.length === 0 ? (
            <Alert variant="light" className="text-center border-0 shadow-sm py-5">
              <p className="mb-0">You haven't made any submissions yet.</p>
              <p>Click the "Join Room" button to get started.</p>
            </Alert>
          ) : (
            <Row>
              {recentSubmissions.map((submission) => (
                <Col key={submission.id} md={6} className="mb-4">
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">
                          {submission?.testcase?.title || 
                            (submission?.testcase?.id
                              ? `Test Case #${submission.testcase.id.substring(0, 8)}`
                              : 'Untitled Test Case')}
                        </h6>
                        <Badge bg={submission.status === 'Solved' ? 'success' : 'danger'} pill>
                          {submission.status}
                        </Badge>
                      </div>
                      <Card.Text>
                        <div className="mt-2">
                          <span className="small text-muted">Input:</span>
                          <pre className="bg-light p-2 mt-1 rounded small">
                            {submission?.testcase?.input || 'No input available'}
                          </pre>
                        </div>
                        <div className="mt-2">
                          <span className="small text-muted">Your Output:</span>
                          <pre className="bg-light p-2 mt-1 rounded small">
                            {submission?.output || 'No output available'}
                          </pre>
                        </div>
                        <div className="mt-2">
                          <span className="small text-muted">Expected Output:</span>
                          <pre className="bg-light p-2 mt-1 rounded small">
                            {submission?.testcase?.expectedOutput || 'No expected output'}
                          </pre>
                        </div>
                      </Card.Text>
                    </Card.Body>
                    <Card.Footer className="bg-white border-0">
                      <small className="text-muted">
                        Submitted on {submission?.createdAt ? new Date(submission.createdAt).toLocaleString() : 'Unknown date'}
                      </small>
                    </Card.Footer>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}
    </Container>
  )
}

export default StudentDashboard