import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  setCode,
  setInput,
  setOutput,
  setLanguage,
  setRunTriggered,
  setRoomId,
  setEditable,
} from '../../redux/slices/editorSlice'
import {
  useRunCodeMutation,
  useCreateTestCaseMutation,
  useGetTestCasesByRoomQuery,
  useGetRoomSubmissionsQuery, // Changed from useGetSubmissionsByStudentQuery
} from '../../redux/api/codeApi'
import CodeEditor from '../../components/editor/CodeEditor'
import LanguageSelector from '../../components/editor/LanguageSelector'
import useSocket from '../../hooks/useSocket'

const TeacherRoom = () => {
  const { roomId } = useParams()
  const dispatch = useDispatch()
  const { code, input, output, language } = useSelector((state) => state.editor)
  
  const [testCaseTitle, setTestCaseTitle] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  
  const [runCode, { isLoading: isRunning }] = useRunCodeMutation()
  const [createTestCase, { isLoading: isPublishing }] = useCreateTestCaseMutation()
  
  // Get test cases for this room
  const { data: testCases, refetch: refetchTestCases } = useGetTestCasesByRoomQuery(roomId, {
    pollingInterval: 5000,
  })
  
  // Get all submissions for this room (fixed endpoint)
  const { data: roomSubmissions, refetch: refetchSubmissions } = useGetRoomSubmissionsQuery(roomId, {
    pollingInterval: 3000,
  })
  
  // Initialize socket connection
  const { 
    isConnected, 
    activeStudents, 
    reconnect,
    emitCodeChange, 
    emitOutputChange, 
    emitLanguageChange,
    emitInputChange,
    socket
  } = useSocket(roomId)

  // Initialize room
  useEffect(() => {
    if (roomId) {
      dispatch(setRoomId(roomId))
      dispatch(setEditable(true))
      
      if (!sessionStorage.getItem('sessionId')) {
        sessionStorage.setItem('sessionId', `teacher-${roomId}-${Date.now()}`)
      }
    }
  }, [roomId, dispatch])

  // Socket listeners for real-time updates
  const navigate = useNavigate()
  
  useEffect(() => {
    if (socket && isConnected) {
      const handleSubmissionUpdate = (data) => {
        console.log('Student submission received:', data)
        refetchSubmissions()
        setLastRefresh(Date.now())
        
        if (data.status === 'Solved') {
          setSuccess(`Student solved: ${data.testCaseTitle || 'Test Case'}!`)
          setTimeout(() => setSuccess(null), 3000)
        }
      }

      const handleStudentJoined = (data) => {
        console.log('Student joined:', data)
        refetchSubmissions()
        setLastRefresh(Date.now())
      }
      
      // Handle room deleted event
      const handleRoomDeleted = (event) => {
        const { detail } = event
        console.log('Room deleted event received:', detail)
        
        if (detail.roomId === roomId) {
          setError(detail.message || 'This room has been deleted by the teacher')
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            navigate('/teacher/dashboard')
          }, 3000)
        }
      }

      socket.on('student-submission-update', handleSubmissionUpdate)
      socket.on('student-joined', handleStudentJoined)
      
      // Listen for room-deleted event
      window.addEventListener('room-deleted', handleRoomDeleted)

      return () => {
        socket.off('student-submission-update')
        socket.off('student-joined')
        window.removeEventListener('room-deleted', handleRoomDeleted)
      }
    }
  }, [socket, isConnected, refetchSubmissions])

  // Handle code change with improved broadcasting
  const handleCodeChange = useCallback((value) => {
    dispatch(setCode(value))
    if (isConnected && emitCodeChange) {
      console.log('Broadcasting code change:', value.substring(0, 50) + '...')
      emitCodeChange(value)
    }
  }, [dispatch, isConnected, emitCodeChange])

  // Handle input change with improved broadcasting
  const handleInputChange = useCallback((e) => {
    const value = e.target.value
    dispatch(setInput(value))
    if (isConnected && emitInputChange) {
      console.log('Broadcasting input change:', value)
      emitInputChange(value)
    }
  }, [dispatch, isConnected, emitInputChange])

  // Handle language change with improved broadcasting
  const handleLanguageChange = useCallback((value) => {
    dispatch(setLanguage(value))
    if (isConnected && emitLanguageChange) {
      console.log('Broadcasting language change:', value)
      emitLanguageChange(value)
    }
  }, [dispatch, isConnected, emitLanguageChange])

  // Run code with improved broadcasting
  const handleRunCode = async () => {
    if (!code.trim()) {
      setError('Please write some code first')
      return
    }
    
    setError(null)
    
    try {
      dispatch(setRunTriggered(true))
      
      const result = await runCode({
        language_id: language,
        source_code: code,
        stdin: input,
      }).unwrap()
      
      const outputText = result.stdout || result.stderr || 'No output'
      dispatch(setOutput(outputText))
      
      if (isConnected && emitOutputChange) {
        console.log('Broadcasting output change:', outputText)
        emitOutputChange(outputText)
      }
      
      dispatch(setRunTriggered(false))
    } catch (err) {
      console.error('Run code error:', err)
      setError(`Failed to run code: ${err?.data?.message || 'Please try again.'}`)
      dispatch(setRunTriggered(false))
    }
  }

  // Publish test case
  const handlePublishTestCase = async () => {
    if (!testCaseTitle.trim()) {
      setError('Please enter a test case title')
      return
    }
    
    if (!output.trim()) {
      setError('Please run the code first to generate output')
      return
    }
    
    setError(null)
    setSuccess(null)
    
    try {
      const result = await createTestCase({
        roomId,
        input,
        expectedOutput: output,
        title: testCaseTitle,
      }).unwrap()
      
      // Broadcast to students
      if (isConnected && socket) {
        socket.emit('test-case-created', { 
          roomId, 
          testCase: result,
          timestamp: Date.now()
        })
      }
      
      setSuccess('Test case published successfully!')
      setTestCaseTitle('')
      refetchTestCases()
      refetchSubmissions()
      setLastRefresh(Date.now())
      
    } catch (err) {
      console.error('Publish test case error:', err)
      setError(err?.data?.message || 'Failed to publish test case')
    }
  }
  
  // Process room submissions data
  const getStatistics = () => {
    if (!roomSubmissions || !Array.isArray(roomSubmissions)) {
      return {
        totalStudents: 0,
        totalSubmissions: 0,
        solvedSubmissions: 0,
        students: []
      }
    }

    // Group submissions by student
    const studentMap = {}
    
    roomSubmissions.forEach(submission => {
      const studentId = submission.studentId || submission.userId
      if (!studentId) return
      
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          id: studentId,
          name: submission.user?.name || `Student ${studentId.substring(0, 8)}`,
          submissions: [],
          attempted: 0,
          solved: 0
        }
      }
      
      studentMap[studentId].submissions.push(submission)
      studentMap[studentId].attempted++
      
      if (submission.status === 'Solved') {
        studentMap[studentId].solved++
      }
    })

    const students = Object.values(studentMap)
    
    return {
      totalStudents: students.length,
      totalSubmissions: roomSubmissions.length,
      solvedSubmissions: roomSubmissions.filter(s => s.status === 'Solved').length,
      students
    }
  }

  const stats = getStatistics()
  const safeActiveStudents = Array.isArray(activeStudents) ? activeStudents : []
  const safeRoomSubmissions = Array.isArray(roomSubmissions) ? roomSubmissions : []

  return (
    <div className="container mx-auto px-4 py-3">
      <div className="mb-4">
        <div className="flex items-center flex-wrap gap-2">
          <span className="bg-gray-600 text-white rounded-md px-3 py-2">
            Teacher Room: {roomId}
          </span>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {!isConnected && (
              <button
                onClick={reconnect}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Last Update */}
          <span className="text-xs text-gray-500">
            Updated: {new Date(lastRefresh).toLocaleTimeString()}
          </span>
          
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelector value={language} onChange={handleLanguageChange} />
            <button 
              className={`rounded-full px-3 py-1 text-sm text-white ${
                isRunning || !code.trim() ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
              }`}
              onClick={handleRunCode}
              disabled={isRunning || !code.trim()}
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError(null)} className="float-right">&times;</button>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
          <button onClick={() => setSuccess(null)} className="float-right">&times;</button>
        </div>
      )}

      <div className="flex flex-wrap -mx-2">
        {/* Left Side - Code Editor */}
        <div className="w-full lg:w-2/3 px-2">
          <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
            <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
              <span className="text-gray-600">Code Editor</span>
              <span className={`px-2 py-1 rounded text-xs text-white ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {isConnected ? 'Broadcasting Live' : 'Offline'}
              </span>
            </div>
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              language={language}
              height="400px"
            />
          </div>

          {/* Test Case Publishing */}
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={testCaseTitle}
                onChange={(e) => setTestCaseTitle(e.target.value)}
                placeholder="Enter test case title"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handlePublishTestCase}
                disabled={isPublishing || !output.trim() || !testCaseTitle.trim()}
                className={`px-4 py-2 rounded-md text-white ${
                  isPublishing || !output.trim() || !testCaseTitle.trim() 
                    ? 'bg-green-300 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isPublishing ? 'Publishing...' : 'Publish Test Case'}
              </button>
            </div>
          </div>

          {/* Input/Output */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="border border-gray-200 rounded-lg">
                <div className="bg-gray-100 py-2 px-4">
                  <span className="text-gray-600">Input</span>
                </div>
                <textarea
                  rows={4}
                  value={input}
                  onChange={handleInputChange}
                  className="w-full p-3 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter input for your code"
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="border border-gray-200 rounded-lg">
                <div className="bg-gray-100 py-2 px-4">
                  <span className="text-gray-600">Output</span>
                </div>
                <textarea
                  rows={4}
                  value={output}
                  readOnly
                  className="w-full p-3 border-0 bg-gray-50 focus:outline-none"
                  placeholder="Output will appear here"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Dashboard */}
        <div className="w-full lg:w-1/3 px-2">
          {/* Student Statistics */}
          <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
            <div className="bg-gray-100 py-2 px-4">
              <span className="text-gray-600">Student Dashboard</span>
            </div>
            <div className="p-4">
              {/* Overall Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalStudents}</div>
                <div className="text-sm text-gray-600">Students</div>
                <div className="text-xs text-gray-500">(Last {roomSubmissions?.activeTimeWindowMinutes || 30} min)</div>
              </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.solvedSubmissions}</div>
                  <div className="text-sm text-gray-600">Solved</div>
                </div>
              </div>

              {/* Live Students */}
              <div className="mb-4">
                <h6 className="font-medium mb-2">Connected Students: {safeActiveStudents.length}</h6>
                {safeActiveStudents.map((student, index) => (
                  <div key={student.id || index} className="flex justify-between items-center py-1">
                    <span className="text-sm">{student.name || `Student ${index + 1}`}</span>
                    <span className={`px-2 py-1 text-xs rounded text-white ${
                      student.status === 'solved' ? 'bg-green-500' : 
                      student.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}>
                      {student.status || 'active'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Student Performance Table */}
              {stats.students.length > 0 && (
                <div>
                  <h6 className="font-medium mb-2">Student Performance:</h6>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stats.students.map((student, index) => (
                      <div key={student.id} className="bg-gray-50 p-2 rounded">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-sm">{student.name}</span>
                          <div className="flex gap-1">
                            <span className="bg-yellow-500 text-white px-2 py-1 text-xs rounded">
                              {student.attempted}
                            </span>
                            <span className="bg-green-500 text-white px-2 py-1 text-xs rounded">
                              {student.solved}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                            style={{ 
                              width: `${student.attempted > 0 ? (student.solved / student.attempted) * 100 : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Published Test Cases */}
          <div className="border border-gray-200 rounded-lg shadow-sm">
            <div className="bg-gray-100 py-2 px-4">
              <span className="text-gray-600">Published Test Cases</span>
            </div>
            <div className="p-4">
              {testCases && testCases.length > 0 ? (
                <div className="space-y-2">
                  {testCases.map((testCase, index) => {
                    // Count submissions for this test case - FIXED: Added proper array check
                    const testCaseSubmissions = safeRoomSubmissions.filter(s => s.testCaseId === testCase.id)
                    const solvedCount = testCaseSubmissions.filter(s => s.status === 'Solved').length
                    
                    return (
                      <div key={testCase.id} className="border border-gray-200 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{index + 1}. {testCase.title}</span>
                          <span className="bg-blue-500 text-white px-2 py-1 text-xs rounded">
                            Active
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          Expected: {testCase.expectedOutput?.substring(0, 50)}
                          {testCase.expectedOutput?.length > 50 && '...'}
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Submissions: {testCaseSubmissions.length}</span>
                          <span className="text-green-600">Solved: {solvedCount}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>No test cases published yet</p>
                  <p className="text-sm">Run your code and publish a test case</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherRoom