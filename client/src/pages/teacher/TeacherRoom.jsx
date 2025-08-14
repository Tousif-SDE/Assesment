import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setCode, setInput, setOutput, setLanguage, setRoomId, setEditable } from '../../redux/slices/editorSlice'
import { useRunCodeMutation } from '../../redux/api/codeApi'
import CodeEditor from '../../components/editor/CodeEditor'
import LanguageSelector from '../../components/editor/LanguageSelector'
import useSocket from '../../hooks/useSocket'
import { Container, Row, Col, Card, Form, Button, Badge, Alert, Tab, Tabs } from 'react-bootstrap'
import { Play, ArrowLeft, Users, Code, Terminal, Send, Plus, X } from 'lucide-react'

// Language ID mapping for Judge0 API
const getLanguageId = (language) => {
  const languageMap = {
    'javascript': 63,
    'python': 71,
    'java': 62,
    'cpp': 54,
    'c': 50,
    'csharp': 51,
    'go': 60,
    'php': 68,
    'ruby': 72,
    'rust': 73,
    'kotlin': 78,
    'swift': 83,
    'typescript': 74
  }
  return languageMap[language] || 71
}

const TeacherRoom = () => {
  const { roomId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { code, input, output, language } = useSelector((state) => state.editor)
  
  const [testCases, setTestCases] = useState([])
  const [newTestCase, setNewTestCase] = useState({ 
    title: '', 
    description: '',
    input: '', 
    expectedOutput: '' 
  })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [roomStats, setRoomStats] = useState({ studentsCount: 0 })
  
  const [runCode, { isLoading: isRunning }] = useRunCodeMutation()
  const { isConnected, socket } = useSocket(roomId)

  // Initialize session
  useEffect(() => {
    if (roomId) {
      dispatch(setRoomId(roomId))
      dispatch(setEditable(true))
      if (!sessionStorage.getItem('sessionId')) {
        sessionStorage.setItem('sessionId', `teacher-${roomId}-${Date.now()}`)
      }
    }
  }, [roomId, dispatch])

  // Socket event handlers
  useEffect(() => {
    if (socket && isConnected) {
      const handleRoomUpdate = (data) => {
        setRoomStats({ studentsCount: data.studentsCount || 0 })
      }

      const handleStudentSubmission = (data) => {
        setSuccess(`Student submitted - ${data.submission.status}`)
        setTimeout(() => setSuccess(null), 3000)
      }

      socket.on('room-update', handleRoomUpdate)
      socket.on('student-submission', handleStudentSubmission)
      
      return () => {
        socket.off('room-update', handleRoomUpdate)
        socket.off('student-submission', handleStudentSubmission)
      }
    }
  }, [socket, isConnected])

  // Auto-clear alerts
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // FIXED: Emit real-time broadcasts for all changes
  const handleCodeChange = useCallback((value) => {
    dispatch(setCode(value))
    if (socket && isConnected) {
      socket.emit('code-update', { 
        code: value, 
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('sessionId')
      })
    }
  }, [dispatch, socket, isConnected])

// In TeacherRoom.js - Fix the handleInputChange function
const handleInputChange = useCallback((e) => {
  const value = e.target.value
  dispatch(setInput(value))
  
  // FIXED: Always broadcast input changes immediately
  if (socket && isConnected) {
    console.log(`📤 Broadcasting input change to room ${roomId}:`, value)
    socket.emit('input-update', { 
      input: value, 
      timestamp: Date.now(),
      sessionId: sessionStorage.getItem('sessionId')
    })
  }
}, [dispatch, socket, isConnected, roomId]) // Add roomId to dependencies

  const handleLanguageChange = useCallback((value) => {
    dispatch(setLanguage(value))
    if (socket && isConnected) {
      socket.emit('language-update', { 
        language: value, 
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('sessionId')
      })
    }
  }, [dispatch, socket, isConnected])

  const handleRunCode = async () => {
    if (!code.trim()) {
      setError('Please write some code first')
      return
    }
    
    try {
      const result = await runCode({
        language_id: getLanguageId(language),
        source_code: code,
        stdin: input,
      }).unwrap()
      
      const outputText = result.stdout || result.stderr || 'No output'
      dispatch(setOutput(outputText))
      
      // FIXED: Broadcast output to all students
      if (socket && isConnected) {
        socket.emit('output-update', { 
          output: outputText, 
          timestamp: Date.now(),
          sessionId: sessionStorage.getItem('sessionId')
        })
      }
    } catch (err) {
      console.error('Run code error:', err)
      setError('Failed to run code')
    }
  }

  const handleCreateTestCase = () => {
    if (!newTestCase.title.trim() || !newTestCase.input.trim() || !newTestCase.expectedOutput.trim()) {
      setError('Please fill all required test case fields (title, input, expected output)')
      return
    }

    if (socket && isConnected) {
      const testCase = {
        ...newTestCase,
        id: `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString()
      }

      socket.emit('create-test-case', { 
        roomId, 
        testCase, 
        timestamp: Date.now() 
      })
      
      setTestCases(prev => [...prev, testCase])
      setNewTestCase({ title: '', description: '', input: '', expectedOutput: '' })
      setSuccess('Test case published to students!')
    } else {
      setError('Not connected to room. Please refresh the page.')
    }
  }

  const handleDeleteTestCase = (testCaseId) => {
    setTestCases(prev => prev.filter(tc => tc.id !== testCaseId))
    setSuccess('Test case deleted')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div className="border-0 shadow-sm position-sticky top-0" style={{ background: 'white', zIndex: 1000 }}>
        <Container fluid className="px-4 py-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <Button variant="link" className="p-0 me-3" onClick={() => navigate('/teacher')}>
                <ArrowLeft size={20} />
              </Button>
              <div className="d-flex align-items-center me-3" style={{ width: '40px', height: '40px', background: '#8b5cf6', borderRadius: '12px' }}>
                <Code size={20} className="text-white mx-auto" />
              </div>
              <div>
                <h4 className="mb-0 fw-bold">Live Coding Session</h4>
                <div className="d-flex align-items-center mt-1">
                  <Badge className="px-3 py-1 me-3" style={{ background: '#8b5cf6' }}>
                    Room: {roomId}
                  </Badge>
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle me-2" style={{ width: '8px', height: '8px', backgroundColor: isConnected ? '#10b981' : '#ef4444' }} />
                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                      {isConnected ? 'Live Broadcasting' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="d-flex align-items-center gap-4">
              <div className="px-4 py-2 rounded-3 d-flex align-items-center" style={{ background: '#f1f5f9' }}>
                <Users size={16} className="me-2" style={{ color: '#8b5cf6' }} />
                <span style={{ fontSize: '14px', color: '#475569' }}>
                  {roomStats.studentsCount} Students
                </span>
              </div>
              <LanguageSelector value={language} onChange={handleLanguageChange} />
              <Button 
                className="px-5 py-2" 
                style={{ background: '#8b5cf6', border: 'none', borderRadius: '12px', color: 'white' }}
                onClick={handleRunCode}
                disabled={isRunning || !code.trim()}
              >
                <Play size={16} className="me-2" />
                {isRunning ? 'Running...' : 'Run Code'}
              </Button>
            </div>
          </div>
        </Container>
      </div>

      {/* Alerts */}
      {error && (
        <Container fluid className="px-4 pt-3">
          <Alert variant="danger" className="d-flex justify-content-between align-items-center">
            <span>{error}</span>
            <Button variant="link" className="p-0 text-danger" onClick={() => setError(null)}>×</Button>
          </Alert>
        </Container>
      )}

      {success && (
        <Container fluid className="px-4 pt-3">
          <Alert variant="success" className="d-flex justify-content-between align-items-center">
            <span>{success}</span>
            <Button variant="link" className="p-0 text-success" onClick={() => setSuccess(null)}>×</Button>
          </Alert>
        </Container>
      )}

      {/* Main Content */}
      <Container fluid className="px-4 pb-4">
        <Row className="g-4">
          {/* Code Editor */}
          <Col lg={8}>
            <Card className="border-0 shadow-sm">
              <div className="px-4 py-3 d-flex justify-content-between align-items-center" style={{ background: '#8b5cf6', color: 'white' }}>
                <div className="d-flex align-items-center">
                  <Code size={20} className="me-2" />
                  <span className="fw-bold">Code Editor</span>
                </div>
                <Badge style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                  {isConnected ? 'Broadcasting Live' : 'Offline'}
                </Badge>
              </div>
              <CodeEditor value={code} onChange={handleCodeChange} language={language} height="500px" />
            </Card>
          </Col>

          {/* Input/Output */}
          <Col lg={4}>
            <Card className="border-0 shadow-sm h-100">
              <div className="px-4 py-3" style={{ background: '#8b5cf6', color: 'white' }}>
                <div className="d-flex align-items-center">
                  <Terminal size={20} className="me-2" />
                  <span className="fw-bold">Input & Output</span>
                </div>
              </div>
              <div className="p-4 h-100 d-flex flex-column" style={{ gap: '20px' }}>
                <div className="flex-fill">
                  <h6 className="fw-bold mb-3" style={{ fontSize: '14px', color: '#475569' }}>INPUT</h6>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Enter test input... (This will be broadcast to all students)"
                    style={{ resize: 'none', fontSize: '14px', fontFamily: 'monospace' }}
                  />
                </div>
                <div className="flex-fill">
                  <h6 className="fw-bold mb-3" style={{ fontSize: '14px', color: '#475569' }}>OUTPUT</h6>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={output}
                    readOnly
                    placeholder="Code output will appear here and be broadcast to students..."
                    style={{ resize: 'none', fontSize: '14px', fontFamily: 'monospace', color: '#059669' }}
                  />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Test Cases */}
        <Row className="mt-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <div className="px-4 py-3" style={{ background: '#8b5cf6', color: 'white' }}>
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <Send size={20} className="me-2" />
                    <span className="fw-bold">Test Cases Management</span>
                  </div>
                  <Badge style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                    {testCases.length} Active
                  </Badge>
                </div>
              </div>
              
              <div className="p-4">
                <Tabs defaultActiveKey="create" className="mb-4">
                  <Tab eventKey="create" title="Create New">
                    <Row className="g-3">
                      <Col md={12}>
                        <Form.Label className="fw-semibold">Test Case Title *</Form.Label>
                        <Form.Control
                          type="text"
                          value={newTestCase.title}
                          onChange={(e) => setNewTestCase(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g., Basic Addition Test, Two Sum Example"
                        />
                      </Col>
                      <Col md={12}>
                        <Form.Label className="fw-semibold">Description (Optional)</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={newTestCase.description}
                          onChange={(e) => setNewTestCase(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Brief description of what this test case validates..."
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Label className="fw-semibold">Input *</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={newTestCase.input}
                          onChange={(e) => setNewTestCase(prev => ({ ...prev, input: e.target.value }))}
                          placeholder="Enter the test input exactly as it should be provided to the program..."
                          style={{ fontFamily: 'monospace' }}
                        />
                      </Col>
                      <Col md={6}>
                        <Form.Label className="fw-semibold">Expected Output *</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={4}
                          value={newTestCase.expectedOutput}
                          onChange={(e) => setNewTestCase(prev => ({ ...prev, expectedOutput: e.target.value }))}
                          placeholder="Enter the exact expected output (whitespace matters)..."
                          style={{ fontFamily: 'monospace' }}
                        />
                      </Col>
                      <Col md={12}>
                        <div className="d-flex gap-3">
                          <Button
                            onClick={handleCreateTestCase}
                            disabled={!newTestCase.title.trim() || !newTestCase.input.trim() || !newTestCase.expectedOutput.trim() || !isConnected}
                            style={{ background: '#8b5cf6', border: 'none' }}
                          >
                            <Plus size={16} className="me-2" />
                            Create & Publish Test Case
                          </Button>
                          <Button
                            variant="outline-secondary"
                            onClick={() => setNewTestCase({ title: '', description: '', input: '', expectedOutput: '' })}
                          >
                            Clear Form
                          </Button>
                        </div>
                      </Col>
                    </Row>
                  </Tab>
                  
                  <Tab eventKey="manage" title={`Manage (${testCases.length})`}>
                    {testCases.length === 0 ? (
                      <div className="text-center py-5">
                        <div className="mb-3">
                          <Send size={48} className="text-muted" />
                        </div>
                        <h6 className="text-muted">No test cases created yet</h6>
                        <p className="text-muted mb-0">Create test cases to challenge your students</p>
                      </div>
                    ) : (
                      <div className="d-grid gap-3">
                        {testCases.map((testCase, index) => (
                          <Card key={testCase.id} className="border">
                            <Card.Body className="p-3">
                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                  <h6 className="fw-bold mb-1">
                                    Test Case {index + 1}: {testCase.title}
                                  </h6>
                                  {testCase.description && (
                                    <p className="text-muted small mb-2">{testCase.description}</p>
                                  )}
                                  <small className="text-muted">
                                    Created: {new Date(testCase.createdAt).toLocaleString()}
                                  </small>
                                </div>
                                <Button 
                                  variant="outline-danger" 
                                  size="sm" 
                                  onClick={() => handleDeleteTestCase(testCase.id)}
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                              <Row>
                                <Col md={6}>
                                  <small className="fw-semibold text-muted">INPUT:</small>
                                  <pre className="mt-1 p-2 bg-light rounded" style={{ fontSize: '12px', maxHeight: '150px', overflow: 'auto' }}>
                                    {testCase.input}
                                  </pre>
                                </Col>
                                <Col md={6}>
                                  <small className="fw-semibold text-muted">EXPECTED OUTPUT:</small>
                                  <pre className="mt-1 p-2 bg-light rounded" style={{ fontSize: '12px', maxHeight: '150px', overflow: 'auto' }}>
                                    {testCase.expectedOutput}
                                  </pre>
                                </Col>
                              </Row>
                            </Card.Body>
                          </Card>
                        ))}
                      </div>
                    )}
                  </Tab>
                </Tabs>
              </div>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default TeacherRoom