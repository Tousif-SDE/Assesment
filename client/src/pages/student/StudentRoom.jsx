import { useState, useEffect } from 'react'
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
} from '../../redux/api/codeApi'
import CodeEditor from '../../components/editor/CodeEditor'
import LanguageSelector from '../../components/editor/LanguageSelector'
import useSocket from '../../hooks/useSocket'

const StudentRoom = () => {
  const { roomId } = useParams()
  const dispatch = useDispatch()
  const { code, input, output, language, isEditable, testCase } = useSelector((state) => state.editor)
  
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [selectedTestCase, setSelectedTestCase] = useState(null)
  const [activeTab, setActiveTab] = useState('broadcast') // Default to broadcast tab
  const [studentCode, setStudentCode] = useState('') // Student's own code
  
  const [runCode, { isLoading: isRunning }] = useRunCodeMutation()
  const [createSubmission, { isLoading: isSubmitting }] = useCreateSubmissionMutation()
  const { data: testCases, isLoading: isLoadingTestCases } = useGetTestCasesByRoomQuery(roomId)
  
  // Initialize socket connection
  const { isConnected, socket, emitLanguageChange, emitCodeChange } = useSocket(roomId)
  
  // Listen for real-time updates from teacher
  useEffect(() => {
    if (isConnected && socket) {
      // When not in editable mode, update code from teacher
      if (!isEditable) {
        socket.on('code-update', ({ code }) => {
          dispatch(updateEditorState({ code }))
        })
      }
      
      // Always listen for output updates
      socket.on('output-update', ({ output }) => {
        dispatch(updateEditorState({ output }))
      })
      
      // Always listen for language updates
      socket.on('language-update', ({ language }) => {
        dispatch(updateEditorState({ language }))
      })
      
      // Listen for input updates
      socket.on('input-update', ({ input }) => {
        dispatch(updateEditorState({ input }))
      })
      
      return () => {
        socket.off('code-update')
        socket.off('output-update')
        socket.off('language-update')
        socket.off('input-update')
      }
    }
  }, [isConnected, socket, dispatch, isEditable])

  // Set room ID in Redux store
  useEffect(() => {
    dispatch(setRoomId(roomId))
  }, [roomId, dispatch])

  // Handle code change for teacher's broadcast code
  const handleCodeChange = (value) => {
    dispatch(setCode(value))
  }

  // Handle code change for student's editable code
  const handleStudentCodeChange = (value) => {
    setStudentCode(value)
    // Only emit code changes when in editable mode
    if (isEditable) {
      emitCodeChange(value)
    }
  }

  // Handle language change
  const handleLanguageChange = (value) => {
    dispatch(setLanguage(value))
    if (isEditable) {
      emitLanguageChange(value)
    }
  }

  // Enable editing (Solve button)
  const handleSolve = () => {
    if (!selectedTestCase) {
      setError('Please select a test case first')
      return
    }
    
    dispatch(setEditable(true))
    dispatch(setTestCase(selectedTestCase))
    setSuccess('You can now edit the code and submit your solution')
    
    // Initialize student code with teacher's code or default template
    setStudentCode(code)
    
    // Switch to the solve tab
    setActiveTab('solve')
    
    // Disable code updates from teacher when in editable mode
    if (socket) {
      socket.off('code-update')
    }
  }

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
      
      const output = result.stdout || result.stderr || 'No output'
      dispatch(setOutput(output))
    } catch (err) {
      console.error('Run code error:', err)
      setError('Failed to run code. Please try again.')
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
    
    try {
      const result = await createSubmission({
        testCaseId: testCase.id,
        code: studentCode,
        language,
      }).unwrap()
      
      const status = result.submission.status
      
      setSuccess(
        status === 'Solved'
          ? 'Congratulations! Your solution is correct.'
          : 'Your solution is incorrect. Please try again.'
      )
      
      // Emit submission status to teacher
      if (socket) {
        socket.emit('submission-status', { 
          roomId, 
          status,
          testCaseId: testCase.id
        })
      }
    } catch (err) {
      console.error('Submission error:', err)
      setError(err?.data?.message || 'Failed to submit solution')
    }
  }

  // Handle test case selection
  const handleTestCaseSelect = (testCase) => {
    setSelectedTestCase(testCase)
    dispatch(setInput(testCase.input))
    dispatch(setEditable(false)) // Reset editable state when selecting a new test case
    dispatch(setTestCase(null))
    setSuccess(null)
    setError(null)
    
    // Re-enable socket code updates when selecting a test case (read-only mode)
    if (socket) {
      socket.on('code-update', ({ code }) => {
        dispatch(updateEditorState({ code }))
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-3">
      <div className="mb-2">
        <div className="flex items-center">
          <span className="bg-blue-600 text-white rounded-md px-3 py-2 mr-2">
            Live Room: {roomId}
          </span>
          <div className="flex items-center mr-2">
            <span className="mr-1">Status:</span>
            <div className={`w-3 h-3 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="ml-auto">
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
              disabled={!isEditable}
              emitLanguageChange={emitLanguageChange}
            />
          </div>
        </div>
      </div>

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
                    Teacher's Broadcast
                  </button>
                  <button
                    className={`py-2 px-4 border-b-2 font-medium text-sm ${activeTab === 'solve' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    onClick={() => setActiveTab('solve')}
                    disabled={!isEditable}
                  >
                    Solve Challenge
                  </button>
                </nav>
              </div>
              
              {activeTab === 'broadcast' && (
                <div className="border border-gray-200 rounded-lg shadow-sm mb-4 mt-4">
                  <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
                    <span>Teacher's Code (Read-Only)</span>
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Broadcast Mode</span>
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
                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Editing Mode</span>
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
                  <div className="flex justify-end gap-2">
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
                          if (isEditable && socket) {
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
                    {testCases?.map((tc) => (
                      <button
                        key={tc.id}
                        className={`w-full text-left px-3 py-2 rounded ${selectedTestCase?.id === tc.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                        onClick={() => handleTestCaseSelect(tc)}
                      >
                        <div className="flex justify-between items-center">
                          <span>{tc.title || `Test Case #${tc.id.substring(0, 4)}`}</span>
                          {tc.solved && <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Solved</span>}
                        </div>
                      </button>
                    ))}
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