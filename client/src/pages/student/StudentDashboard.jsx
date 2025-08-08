import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Row, Col, Card, Button, Alert, Spinner, Badge, Container } from 'react-bootstrap'
import { useGetSubmissionsByStudentQuery } from '../../redux/api/codeApi'

const StudentDashboard = () => {
  const {
    data: submissionData,
    error,
    isLoading,
    refetch,
  } = useGetSubmissionsByStudentQuery()

  useEffect(() => {
    // Refetch submissions when component mounts
    refetch()
  }, [])

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
                  <h3 className="text-primary">{submissionData?.totalActive || 0}</h3>
                  <p className="text-muted mb-0">Active Test Cases</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center border-0 shadow-sm">
                <Card.Body>
                  <h3 className="text-warning">{submissionData?.totalAttempted || 0}</h3>
                  <p className="text-muted mb-0">Attempted</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center border-0 shadow-sm">
                <Card.Body>
                  <h3 className="text-success">{submissionData?.totalSolved || 0}</h3>
                  <p className="text-muted mb-0">Solved</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <h5 className="text-secondary mb-3">Recent Submissions</h5>
          
          {submissionData?.submissions?.length === 0 ? (
            <Alert variant="light" className="text-center border-0 shadow-sm py-5">
              <p className="mb-0">You haven't made any submissions yet.</p>
              <p>Click the "Join Room" button to get started.</p>
            </Alert>
          ) : (
            <Row>
              {submissionData?.submissions?.map((submission) => (
                <Col key={submission.id} md={6} className="mb-4">
                  <Card className="border-0 shadow-sm">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">{submission.testCase.title || `Test Case #${submission.testCase.id.substring(0, 4)}`}</h6>
                        <Badge bg={submission.status === 'Solved' ? 'success' : 'danger'} pill>
                          {submission.status}
                        </Badge>
                      </div>
                      <Card.Text>
                        <div className="mt-2">
                          <span className="small text-muted">Input:</span>
                          <pre className="bg-light p-2 mt-1 rounded small">{submission.testCase.input}</pre>
                        </div>
                        <div className="mt-2">
                          <span className="small text-muted">Your Output:</span>
                          <pre className="bg-light p-2 mt-1 rounded small">{submission.output}</pre>
                        </div>
                      </Card.Text>
                    </Card.Body>
                    <Card.Footer className="bg-white border-0">
                      <small className="text-muted">
                        Submitted on {new Date(submission.createdAt).toLocaleString()}
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