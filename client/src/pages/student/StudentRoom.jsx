import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  setCode,
  setInput,
  setOutput,
  setLanguage,
  setEditable,
  setRoomId,
  setTestCase,
  updateEditorState,
} from '../../redux/slices/editorSlice'
import {
  useRunCodeMutation,
  useCreateSubmissionMutation,
  useGetTestCasesByRoomQuery,
  useGetSubmissionsByStudentQuery,
} from '../../redux/api/codeApi'
import CodeEditor from '../../components/editor/CodeEditor'
import LanguageSelector from '../../components/editor/LanguageSelector'
import useSocket from '../../hooks/useSocket'
import Confetti from 'react-confetti'

const StudentRoom = () => {
  const { roomId } = useParams()
  const dispatch = useDispatch()
  const { code, input, output, language, isEditable, testCase } = useSelector((state) => state.editor)
  
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [selectedTestCase, setSelectedTestCase] = useState(null)
  const [activeTab, setActiveTab] = useState('broadcast') // Default to broadcast tab
  const [studentCode, setStudentCode] = useState('') // Student's own code
  const [newTestCases, setNewTestCases] = useState({}) // Track new test cases
  const [showConfetti, setShowConfetti] = useState(false) // For confetti animation
  const [showAchievement, setShowAchievement] = useState(false) // For achievement notification
  const [startTime, setStartTime] = useState(null) // For tracking time spent on a test case
  const [elapsedTime, setElapsedTime] = useState(0) // Elapsed time in seconds
  const [isInitialized, setIsInitialized] = useState(false)
  const [lastBroadcastReceived, setLastBroadcastReceived] = useState(null)
  
  // Refs for stable references
  const newTestCasesRef = useRef(newTestCases)
  const selectedTestCaseRef = useRef(selectedTestCase)
  
  const [runCode, { isLoading: isRunning }] = useRunCodeMutation()
  const [createSubmission, { isLoading: isSubmitting }] = useCreateSubmissionMutation()
  const { data: testCases, isLoading: isLoadingTestCases, refetch: refetchTestCases } = useGetTestCasesByRoomQuery(roomId)
  const { data: submissionData, refetch: refetchSubmissions } = useGetSubmissionsByStudentQuery(undefined, {
    pollingInterval: 5000, // Poll every 5 seconds
  })
  
  // Initialize socket connection
  const { 
    isConnected, 
    socket, 
    connectionAttempts,
    lastActivity,
    reconnect,
    emitLanguageChange, 
    emitCodeChange 
  } = useSocket(roomId)
  
  // Update refs when values change
  useEffect(() => {
    newTestCasesRef.current = newTestCases
    selectedTestCaseRef.current = selectedTestCase
  }, [newTestCases, selectedTestCase])

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  }, [])

  // Initialize student session
  useEffect(() => {
    if (roomId) {
      dispatch(setRoomId(roomId))
      
      // Set session ID for socket identification
      if (!sessionStorage.getItem('sessionId')) {
        sessionStorage.setItem('sessionId', `student-${roomId}-${Date.now()}`)
      }
      
      setIsInitialized(true)
    }
  }, [roomId, dispatch])

  // Handle test case selection - with better error handling
  const handleTestCaseSelect = useCallback((testCase) => {
    if (!testCase || !testCase.id) {
      console.error('Invalid test case selected')
      return
    }

    setSelectedTestCase(testCase)
    dispatch(setInput(testCase.input || ''))
    dispatch(setEditable(false)) // Reset editable state when selecting a new test case
    dispatch(setTestCase(null))
    setSuccess(null)
    setError(null)
    setStartTime(new Date()) // Start the timer when a test case is selected
    setElapsedTime(0) // Reset elapsed time
    
    // If this is a new test case, remove the new status
    if (newTestCasesRef.current[testCase.id]) {
      setNewTestCases(prev => {
        const updated = { ...prev }
        delete updated[testCase.id]
        return updated
      })
    }
    
    // Switch to broadcast tab when selecting a test case
    setActiveTab('broadcast')
    
    console.log('Test case selected:', testCase.title || testCase.id)
  }, [dispatch])

  // Enhanced socket event listeners
  useEffect(() => {
    if (!isConnected || !socket || !isInitialized) return

    const handleCodeUpdate = ({ code, timestamp }) => {
      if (!isEditable && code !== undefined) {
        dispatch(setCode(code))
        setLastBroadcastReceived(new Date(timestamp || Date.now()).toLocaleTimeString())
        console.log('Code update received from teacher')
      }
    }

    const handleOutputUpdate = ({ output, timestamp }) => {
      if (output !== undefined) {
        dispatch(setOutput(output))
        setLastBroadcastReceived(new Date(timestamp || Date.now()).toLocaleTimeString())
        console.log('Output update received from teacher')
      }
    }
    
    const handleLanguageUpdate = ({ language, timestamp }) => {
      if (language !== undefined) {
        dispatch(setLanguage(language))
        setLastBroadcastReceived(new Date(timestamp || Date.now()).toLocaleTimeString())
        console.log('Language update received from teacher:', language)
      }
    }

    const handleInputUpdate = ({ input, timestamp }) => {
      if (input !== undefined) {
        dispatch(setInput(input))
        setLastBroadcastReceived(new Date(timestamp || Date.now()).toLocaleTimeString())
        console.log('Input update received from teacher')
      }
    }

    const handleTestCaseCreated = ({ testCase, timestamp }) => {
      console.log('New test case received:', testCase)
      
      if (testCase && testCase.id) {
        // Refetch test cases
        refetchTestCases().then(() => {
          // Automatically select the new test case
          handleTestCaseSelect(testCase)
          
          // Show success message
          setSuccess(`New test case published: ${testCase.title || 'Untitled Test Case'}`)
          
          // Play notification sound (if available)
          try {
            const audio = new Audio('/notification.mp3')
            audio.volume = 0.5
            audio.play().catch(() => {
              // Ignore audio errors (file might not exist)
            })
          } catch (e) {
            // Ignore audio errors
          }
          
          // Mark this test case as new
          setNewTestCases(prev => ({
            ...prev,
            [testCase.id]: true
          }))
          
          // Show browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Test Case Available!', {
              body: `${testCase.title || 'Untitled Test Case'} has been published`,
              icon: '/favicon.ico',
              tag: 'test-case-' + testCase.id
            })
          }
          
          // Clear success message after 5 seconds
          setTimeout(() => setSuccess(null), 5000)
          
          // Remove the 'new' status after 30 seconds
          setTimeout(() => {
            setNewTestCases(prev => {
              const updated = { ...prev }
              delete updated[testCase.id]
              return updated
            })
          }, 30000)
        })
      }
    }

    // Set up socket event listeners
    socket.on('code-update', handleCodeUpdate)
    socket.on('output-update', handleOutputUpdate)
    socket.on('language-update', handleLanguageUpdate)
    socket.on('input-update', handleInputUpdate)
    socket.on('test-case-created', handleTestCaseCreated)

    // Cleanup function
    return () => {
      socket.off('code-update', handleCodeUpdate)
      socket.off('output-update', handleOutputUpdate)
      socket.off('language-update', handleLanguageUpdate)
      socket.off('input-update', handleInputUpdate)
      socket.off('test-case-created', handleTestCaseCreated)
    }
  }, [isConnected, socket, dispatch, isEditable, isInitialized, refetchTestCases, handleTestCaseSelect])

  // Listen for custom test case events (fallback)
  useEffect(() => {
    const handleTestCaseCreated = (event) => {
      const testCase = event.detail
      if (testCase && testCase.id) {
        console.log('Test case event received:', testCase)
        refetchTestCases()
      }
    }
    
    window.addEventListener('test-case-created', handleTestCaseCreated)
    
    return () => {
      window.removeEventListener('test-case-created', handleTestCaseCreated)
    }
  }, [refetchTestCases])
  
  // Refetch submissions when a new submission is made
  useEffect(() => {
    if (success && success.includes('solution')) {
      refetchSubmissions()
    }
  }, [success, refetchSubmissions])
  
  // Timer for tracking time spent on a test case
  useEffect(() => {
    let timerId;
    
    if (startTime && isEditable) {
      timerId = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else if (!isEditable) {
      setStartTime(null);
      setElapsedTime(0);
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [startTime, isEditable]);

  // Handle code change for teacher's broadcast code
  const handleCodeChange = useCallback((value) => {
    dispatch(setCode(value))
  }, [dispatch])

  // Handle code change for student's editable code
  const handleStudentCodeChange = useCallback((value) => {
    setStudentCode(value)
    // Only emit code changes when in editable mode
    if (isEditable && isConnected) {
      emitCodeChange(value)
    }
  }, [isEditable, isConnected, emitCodeChange])

  // Handle language change
  const handleLanguageChange = useCallback((value) => {
    dispatch(setLanguage(value))
    if (isEditable && isConnected) {
      emitLanguageChange(value)
    }
  }, [dispatch, isEditable, isConnected, emitLanguageChange])

  // Enable editing (Solve button)
  const handleSolve = useCallback(() => {
    if (!selectedTestCase) {
      setError('Please select a test case first')
      return
    }
    
    dispatch(setEditable(true))
    dispatch(setTestCase(selectedTestCase))
    setSuccess('You can now edit the code and submit your solution')
    
    // Initialize student code with teacher's code or default template
    setStudentCode(code || '// Write your solution here')
    
    // Start the timer when student begins solving
    setStartTime(new Date())
    setElapsedTime(0)
    
    // Switch to the solve tab
    setActiveTab('solve')
    
    console.log('Started solving test case:', selectedTestCase.title || selectedTestCase.id)
  }, [selectedTestCase, dispatch, code])

  // Run code
  const handleRunCode = async () => {
    if (!studentCode.trim()) {
      setError('Please write some code first')
      return
    }
    
    setError(null)
    setSuccess(null)
    
    try {
      const result = await runCode({
        language_id: language,
        source_code: studentCode,
        stdin: input,
      }).unwrap()
      
      const outputText = result.stdout || result.stderr || 'No output'
      dispatch(setOutput(outputText))
      console.log('Code executed successfully')
    } catch (err) {
      console.error('Run code error:', err)
      setError(`Failed to run code: ${err?.data?.message || 'Please try again.'}`)
    }
  }

  // Submit solution
  const handleSubmit = async () => {
    if (!studentCode.trim()) {
      setError('Please write some code first')
      return
    }
    
    setError(null)
    setSuccess(null)
    
    if (!testCase) {
      setError('No test case selected')
      return
    }
    
    // Calculate time taken to solve this test case
    const timeTaken = startTime ? Math.floor((new Date() - startTime) / 1000) : 0
    
    try {
      const result = await createSubmission({
        testCaseId: testCase.id,
        code: studentCode,
        language,
        timeTaken: timeTaken,
      }).unwrap()
      
      const status = result.submission?.status || 'Unknown'
      
      if (status === 'Solved') {
        setSuccess('🎉 Congratulations! Your solution is correct.')
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 5000)
        
        // Emit submission status to teacher
        if (socket && socket.connected) {
          socket.emit('submission-status', { 
            roomId, 
            status,
            testCaseId: testCase.id,
            timeTaken
          })
        }
        
        // Refetch submissions to update stats
        refetchSubmissions().then(response => {
          const data = response.data
          if (data && data.totalSolved === data.totalActive && data.totalActive > 0) {
            setSuccess('🏆 Amazing! You have solved all test cases! 🏆')
            setShowConfetti(true)
            setShowAchievement(true)
            setTimeout(() => setShowConfetti(false), 8000)
            setTimeout(() => setShowAchievement(false), 10000)
          }
        })
      } else {
        setSuccess('❌ Your solution is incorrect. Please try again.')
      }
      
      console.log('Submission result:', status)
      
    } catch (err) {
      console.error('Submission error:', err)
      setError(err?.data?.message || 'Failed to submit solution')
    }
  }

  // Connection status helpers
  const getConnectionStatusColor = () => {
    if (isConnected) return 'bg-green-500'
    if (connectionAttempts > 0) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getConnectionStatusText = () => {
    if (isConnected) return 'Connected'
    if (connectionAttempts > 0) return `Reconnecting... (${connectionAttempts})`
    return 'Disconnected'
  }

  return (
      <div className="container mx-auto px-4 py-3">
        {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />}
        
        {/* Achievement Notification */}
        {showAchievement && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl p-6 border-4 border-yellow-500 animate-bounce pointer-events-auto max-w-md">
              <div className="text-center">
                <div className="text-5xl mb-2">🏆</div>
                <h2 className="text-2xl font-bold text-yellow-600 mb-2">Achievement Unlocked!</h2>
                <p className="text-lg font-semibold">Master Problem Solver</p>
                <p className="text-gray-600 mt-2">You've solved all the test cases in this room!</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="bg-blue-600 text-white rounded-md px-3 py-2">
              Live Room: {roomId}
            </span>
            
            {/* Connection Status */}
            <div className="flex items-center">
              <span className="mr-1 text-sm">Status:</span>
              <div className={`w-3 h-3 rounded-full mr-1 ${getConnectionStatusColor()}`}></div>
              <span className="text-sm">{getConnectionStatusText()}</span>
              {!isConnected && (
                <button
                  onClick={reconnect}
                  className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  Reconnect
                </button>
              )}
            </div>

            {/* Last Broadcast Received */}
            {lastBroadcastReceived && (
              <div className="text-xs text-gray-500 bg-gray-100 rounded px-2 py-1">
                Last update: {lastBroadcastReceived}
              </div>
            )}

            {/* Last Activity */}
            {lastActivity && (
              <div className="text-xs text-gray-500">
                Activity: {lastActivity}
              </div>
            )}
            
            <div className="ml-auto">
              <LanguageSelector
                value={language}
                onChange={handleLanguageChange}
                disabled={!isEditable}
              />
            </div>
          </div>
        </div>

        {/* Connection Warning */}
        {!isConnected && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4" role="alert">
            <div className="flex justify-between items-center">
              <span>⚠️ Not connected to live session. You won't receive real-time updates from teacher.</span>
              <button
                onClick={reconnect}
                className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        <div>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{error}</span>
              <button 
                className="absolute top-0 bottom-0 right-0 px-4 py-3" 
                onClick={() => setError(null)}
              >
                <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <title>Close</title>
                  <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
              </button>
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              <span className="block sm:inline">{success}</span>
              <button 
                className="absolute top-0 bottom-0 right-0 px-4 py-3" 
                onClick={() => setSuccess(null)}
              >
                <svg className="fill-current h-6 w-6 text-green-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <title>Close</title>
                  <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                </svg>
              </button>
            </div>
          )}

          <div className="flex flex-wrap -mx-2">
            <div className="w-full lg:w-2/3 px-2">
              <div className="mb-4">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex">
                    <button
                      className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'broadcast' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                      onClick={() => setActiveTab('broadcast')}
                    >
                      Teacher's Broadcast {!isConnected && '(Offline)'}
                    </button>
                    <button
                      className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'solve' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                      onClick={() => setActiveTab('solve')}
                      disabled={!isEditable}
                    >
                      Solve Challenge {isEditable ? '✓' : ''}
                    </button>
                  </nav>
                </div>
                
                {activeTab === 'broadcast' && (
                  <div className="border border-gray-200 rounded-lg shadow-sm mb-4 mt-4">
                    <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
                      <span>Teacher's Code (Read-Only)</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded text-white ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
                          {isConnected ? 'Live' : 'Offline'}
                        </span>
                        {selectedTestCase && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                            {selectedTestCase.title || 'Test Case Selected'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-0">
                      <CodeEditor
                        value={code}
                        onChange={handleCodeChange}
                        language={language}
                        readOnly={true}
                        height="400px"
                      />
                    </div>
                  </div>
                )}
                
                {activeTab === 'solve' && (
                  <div className="border border-gray-200 rounded-lg shadow-sm mb-4 mt-4">
                    <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
                      <span>Your Solution</span>
                      <div className="flex items-center gap-2">
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Editing Mode</span>
                        {testCase && (
                          <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded">
                            Solving: {testCase.title || 'Test Case'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-0">
                      <CodeEditor
                        value={studentCode}
                        onChange={handleStudentCodeChange}
                        language={language}
                        readOnly={false}
                        height="400px"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <div className="border border-gray-200 rounded-lg shadow-sm">
                    <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
                      <span>Test Case Information</span>
                      {!isEditable && selectedTestCase && (
                        <button
                          className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-full"
                          onClick={handleSolve}
                          disabled={!selectedTestCase}
                        >
                          Solve This Challenge
                        </button>
                      )}
                    </div>
                    <div className="p-4">
                      {selectedTestCase ? (
                        <>
                          <div className="mb-3">
                            <label className="block font-medium mb-1">Expected Output:</label>
                            <textarea
                              rows={3}
                              value={selectedTestCase?.expectedOutput || ''}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                            />
                          </div>
                          {testCase ? (
                            <div className="text-center">
                              <span className="bg-green-500 text-white px-3 py-1 rounded-md mb-2 inline-block">You are solving this challenge</span>
                              {activeTab === 'broadcast' && (
                                <div className="mt-2">
                                  <p className="mb-1">Switch to the "Solve Challenge" tab to edit your solution</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="mb-1">Click "Solve This Challenge" to start coding your solution</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-3">
                          <p className="mb-1">Select a test case from the right panel</p>
                          <p className="text-gray-500 text-sm">or wait for the teacher to publish new test cases</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isEditable && activeTab === 'solve' && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      {/* Timer display */}
                      {startTime && (
                        <div className="text-sm text-gray-600 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Time elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-full flex items-center mr-2"
                          onClick={handleRunCode}
                          disabled={isRunning || !studentCode.trim()}
                        >
                          {isRunning ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running...
                            </>
                          ) : 'Run'}
                        </button>
                        <button
                          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-full flex items-center"
                          onClick={handleSubmit}
                          disabled={isSubmitting || !studentCode.trim()}
                        >
                          {isSubmitting ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Submitting...
                            </>
                          ) : 'Submit Solution'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {isEditable && activeTab === 'broadcast' && (
                  <div className="mb-4">
                    <div className="flex justify-center">
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-full"
                        onClick={() => setActiveTab('solve')}
                      >
                        Switch to Solve Mode
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap -mx-2 mb-4">
                  <div className="w-full md:w-1/2 px-2">
                    <div className="border border-gray-200 rounded-lg shadow-sm">
                      <div className="bg-gray-100 py-2 px-4">Your Input</div>
                      <div className="p-4">
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={4}
                          value={input}
                          readOnly={!isEditable}
                          onChange={(e) => {
                            const newInput = e.target.value;
                            dispatch(setInput(newInput));
                            // Only emit input changes when in editable mode
                            if (isEditable && socket && socket.connected) {
                              socket.emit('input-change', { roomId, input: newInput });
                            }
                          }}
                          placeholder="Input will appear here..."
                        />
                      </div>
                    </div>
                  </div>
                  <div className="w-full md:w-1/2 px-2">
                    <div className="border border-gray-200 rounded-lg shadow-sm">
                      <div className="bg-gray-100 py-2 px-4">Your Output</div>
                      <div className="p-4">
                        <textarea
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                          rows={4}
                          value={output}
                          readOnly
                          placeholder="Output will appear here..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-1/3 px-2">
              {/* Student Statistics */}
              <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
                <div className="bg-gray-100 py-2 px-4">
                  <span>Your Progress</span>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-blue-50 p-2 rounded text-center">
                      <div className="text-xl font-semibold text-blue-600">{submissionData?.totalActive || 0}</div>
                      <div className="text-xs text-gray-600">Active</div>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded text-center">
                      <div className="text-xl font-semibold text-yellow-600">{submissionData?.totalAttempted || 0}</div>
                      <div className="text-xs text-gray-600">Attempted</div>
                    </div>
                    <div className="bg-green-50 p-2 rounded text-center">
                      <div className="text-xl font-semibold text-green-600">{submissionData?.totalSolved || 0}</div>
                      <div className="text-xs text-gray-600">Solved</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-500 ease-in-out" 
                      style={{ width: `${submissionData?.totalActive > 0 ? (submissionData.totalSolved / submissionData.totalActive) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-center text-gray-500">
                    {submissionData?.totalSolved || 0} of {submissionData?.totalActive || 0} completed
                  </div>
                </div>
              </div>
              
              {/* Available Test Cases */}
              <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
                <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
                  <span>Available Test Cases</span>
                  {testCases?.length > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      {testCases.length}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  {isLoadingTestCases ? (
                    <div className="text-center py-4">
                      <svg className="animate-spin h-5 w-5 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-2">Loading test cases...</p>
                    </div>
                  ) : testCases?.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="mb-1">No test cases available yet</p>
                      <p className="text-gray-500 text-sm">Wait for your teacher to publish test cases</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {testCases?.map((tc) => {
                         const isNew = newTestCases[tc.id] || false;
                         const isSolved = submissionData?.solvedTestCases?.some(solved => solved.id === tc.id);
                         const isSelected = selectedTestCase?.id === tc.id;
                         
                         return (
                           <button
                             key={tc.id}
                             className={`w-full text-left px-3 py-2 rounded transition-all ${
                               isSelected 
                                 ? 'bg-blue-500 text-white' 
                                 : isNew 
                                   ? 'bg-yellow-50 border border-yellow-400 hover:bg-yellow-100' 
                                   : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                             }`}
                             onClick={() => handleTestCaseSelect(tc)}
                           >
                             <div className="flex justify-between items-center">
                               <div className="flex items-center">
                                 <span>{tc.title || `Test Case #${tc.id.substring(0, 4)}`}</span>
                                 {isNew && <span className="ml-2 text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full animate-pulse">NEW</span>}
                               </div>
                               <div className="flex items-center gap-1">
                                 {isSolved && <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">✓</span>}
                                 {isSelected && <span className="bg-white text-blue-500 text-xs px-2 py-1 rounded-full">Selected</span>}
                               </div>
                             </div>
                           </button>
                         );
                       })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
}

export default StudentRoom