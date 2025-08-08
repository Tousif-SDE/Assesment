import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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
  
  const [runCode, { isLoading: isRunning }] = useRunCodeMutation()
  const [createTestCase, { isLoading: isPublishing }] = useCreateTestCaseMutation()
  
  // Get test cases for this room
  const { data: testCases, isLoading: isLoadingTestCases } = useGetTestCasesByRoomQuery(roomId, {
    pollingInterval: 10000, // Poll every 10 seconds
  })
  
  // Initialize socket connection
  const { 
    isConnected, 
    activeStudents, 
    emitCodeChange, 
    emitOutputChange, 
    emitLanguageChange,
    emitInputChange 
  } = useSocket(roomId)

  // Set room ID in Redux store and ensure teacher can edit
  useEffect(() => {
    dispatch(setRoomId(roomId))
    dispatch(setEditable(true)) // Teachers can always edit
  }, [roomId, dispatch])

  // Handle code change
  const handleCodeChange = (value) => {
    dispatch(setCode(value))
    // Emit code change to all students in the room
    emitCodeChange(value)
  }

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value
    dispatch(setInput(value))
    // Emit input change to all students in the room
    emitInputChange(value)
  }

  // Handle language change
  const handleLanguageChange = (value) => {
    dispatch(setLanguage(value))
    // Emit language change to all students in the room
    emitLanguageChange(value)
  }

  // Run code
  const handleRunCode = async () => {
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
      
      // Emit output change to all students in the room
      emitOutputChange(outputText)
      
      dispatch(setRunTriggered(false))
    } catch (err) {
      setError('Failed to run code. Please try again.')
      dispatch(setRunTriggered(false))
    }
  }

  // Publish test case
  const handlePublishTestCase = async () => {
    setError(null)
    setSuccess(null)
    
    if (!testCaseTitle.trim()) {
      setError('Please enter a test case title')
      return
    }
    
    if (!output.trim()) {
      setError('Please run the code first to generate output')
      return
    }
    
    try {
      await createTestCase({
        roomId,
        input,
        expectedOutput: output,
        title: testCaseTitle,
      }).unwrap()
      
      setSuccess('Test case published successfully!')
      setTestCaseTitle('')
    } catch (err) {
      setError(err?.data?.message || 'Failed to publish test case')
    }
  }
  
  // Calculate solved count
  const solvedCount = activeStudents?.filter(student => student.status === 'solved').length || 0
  const totalStudents = activeStudents?.length || 0

  return (
    <div className="container mx-auto px-4 py-3">
      <div className="mb-2">
        <div className="flex items-center">
          <span className="bg-gray-600 text-white rounded-md px-3 py-2 mr-2">
            Live Room: {roomId}
          </span>
          <div className="flex items-center ml-2">
            <div className={`w-3 h-3 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="ml-auto flex items-center">
            <LanguageSelector
              value={language}
              onChange={handleLanguageChange}
              emitLanguageChange={emitLanguageChange}
            />
            <button 
              className={`ml-2 rounded-full px-3 py-1 text-sm text-white ${isRunning || !code.trim() ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
              onClick={handleRunCode}
              disabled={isRunning || !code.trim()}
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running...
                </>
              ) : 'Run'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <title>Close</title>
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
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
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-wrap -mx-2">
        <div className="w-full lg:w-2/3 px-2">
          <div className="mb-4 rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div className="bg-gray-100 flex justify-between items-center py-2 px-4">
              <span className="text-gray-600">Teacher's Code Editor</span>
              <span className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs">Live Sharing</span>
            </div>
            <div>
              <CodeEditor
                value={code}
                onChange={handleCodeChange}
                language={language}
                height="400px"
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between items-center">
              <div className="flex-grow mr-2">
                <input
                  type="text"
                  value={testCaseTitle}
                  onChange={(e) => setTestCaseTitle(e.target.value)}
                  placeholder="Enter test case title (e.g., 'Find Maximum Number')"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <button
                onClick={handlePublishTestCase}
                disabled={isPublishing || !output.trim() || !testCaseTitle.trim()}
                className={`rounded-full px-4 py-2 ${isPublishing || !output.trim() || !testCaseTitle.trim() ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white`}
              >
                {isPublishing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Publishing...
                  </>
                ) : 'Publish Test Case'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap -mx-2 mb-3">
            <div className="w-full md:w-1/2 px-2">
              <div className="border border-gray-200 rounded-lg shadow-sm h-full">
                <div className="bg-gray-100 py-2 px-4">
                  <span className="text-gray-600">Input</span>
                </div>
                <div className="p-2">
                  <textarea
                    rows={4}
                    value={input}
                    onChange={handleInputChange}
                    className="w-full p-2 bg-gray-100 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter input for your code (e.g., '10 20 30')"
                  />
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2 px-2">
              <div className="border border-gray-200 rounded-lg shadow-sm h-full">
                <div className="bg-gray-100 py-2 px-4">
                  <span className="text-gray-600">Output</span>
                </div>
                <div className="p-2">
                  <textarea
                    rows={4}
                    value={output}
                    readOnly
                    className="w-full p-2 bg-gray-100 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Output will appear here after running the code"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/3 px-2">
          <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
            <div className="bg-gray-100 py-2 px-4">
              <span className="text-gray-600">Student Progress</span>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h6 className="m-0 font-medium">Active Students:</h6>
                <span className="bg-blue-600 text-white px-3 py-1 rounded-md">{totalStudents}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <h6 className="m-0 font-medium">Solved:</h6>
                <span className="bg-green-600 text-white px-3 py-1 rounded-md">{solvedCount}</span>
              </div>
              
              {isLoadingTestCases ? (
                <div className="text-center py-3">
                  <svg className="animate-spin h-5 w-5 text-gray-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : testCases && testCases.length > 0 ? (
                <div className="mt-4">
                  <h6 className="mb-3 font-medium">Published Test Cases:</h6>
                  {testCases.map((testCase, index) => (
                    <div key={testCase.id} className="mb-2 p-2 border border-gray-200 rounded">
                      <div className="flex justify-between items-center">
                        <span>{index + 1}. {testCase.title}</span>
                        <span className="bg-blue-500 text-white px-2 py-1 text-xs rounded">Active</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 mb-0 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded">
                  No test cases published yet. Run your code and publish a test case for students to solve.
                </div>
              )}
              
              {activeStudents && activeStudents.length > 0 && (
                <div className="mt-4">
                  <h6 className="mb-3 font-medium">Student Status:</h6>
                  {activeStudents.map((student, index) => (
                    <div key={student.id || index} className="mb-2">
                      <div className="flex justify-between items-center">
                        <span>{index + 1}. {student.name}</span>
                        <span 
                          className={`px-2 py-1 text-xs rounded text-white ${student.status === 'solved' ? 'bg-green-600' : 
                             student.status === 'failed' ? 'bg-red-600' : 'bg-yellow-500'}`}
                        >
                          {student.status === 'solved' ? 'Solved' : 
                           student.status === 'failed' ? 'Failed' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  ))}
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