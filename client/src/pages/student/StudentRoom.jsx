// client/src/pages/student/StudentRoom.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  setCode,
  setInput,
  setOutput,
  setLanguage,
  setEditable,
  setRoomId,
  setTestCase,
} from '../../redux/slices/editorSlice';
import {
  useRunCodeMutation,
  useCreateSubmissionMutation,
  useGetTestCasesByRoomQuery,
  useGetSubmissionsByStudentQuery,
} from '../../redux/api/codeApi';
import CodeEditor from '../../components/editor/CodeEditor';
import LanguageSelector from '../../components/editor/LanguageSelector';
import useSocket from '../../hooks/useSocket';

const StudentRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { code, input, output, language, isEditable, testCase } = useSelector((state) => state.editor);
  
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const [activeTab, setActiveTab] = useState('broadcast');
  const [studentCode, setStudentCode] = useState('');
  const [studentOutput, setStudentOutput] = useState(''); // Separate output for student's code
  const [newTestCases, setNewTestCases] = useState({});
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use refs to track the latest values
  const latestCodeRef = useRef(code);
  const latestInputRef = useRef(input);
  const latestOutputRef = useRef(output);
  const latestLanguageRef = useRef(language);
  const isEditableRef = useRef(isEditable);
  
  const [runCode, { isLoading: isRunning }] = useRunCodeMutation();
  const [createSubmission, { isLoading: isSubmitting }] = useCreateSubmissionMutation();
  
  // Get test cases and submissions
  const { data: testCases, refetch: refetchTestCases } = useGetTestCasesByRoomQuery(roomId, {
    pollingInterval: 5000,
  });
  
  const { data: submissions, refetch: refetchSubmissions } = useGetSubmissionsByStudentQuery(roomId, {
    pollingInterval: 3000,
  });
  
  // Socket connection
  const { 
    isConnected, 
    socket, 
    reconnect,
    emitCodeChange 
  } = useSocket(roomId);
  
  // Update refs when state changes
  useEffect(() => {
    latestCodeRef.current = code;
  }, [code]);
  
  useEffect(() => {
    latestInputRef.current = input;
  }, [input]);
  
  useEffect(() => {
    latestOutputRef.current = output;
  }, [output]);
  
  useEffect(() => {
    latestLanguageRef.current = language;
  }, [language]);
  
  useEffect(() => {
    isEditableRef.current = isEditable;
  }, [isEditable]);
  
  // Initialize student session
  useEffect(() => {
    if (roomId) {
      dispatch(setRoomId(roomId));
      
      if (!sessionStorage.getItem('sessionId')) {
        sessionStorage.setItem('sessionId', `student-${roomId}-${Date.now()}`);
      }
      
      setIsInitialized(true);
    }
  }, [roomId, dispatch]);
  
  // Handle room deleted event
  useEffect(() => {
    const handleRoomDeleted = (event) => {
      const { detail } = event;
      console.log('Room deleted event received:', detail);
      
      if (detail.roomId === roomId) {
        setError(detail.message || 'This room has been deleted by the teacher');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/student/dashboard');
        }, 3000);
      }
    };
    
    // Listen for room-deleted event
    window.addEventListener('room-deleted', handleRoomDeleted);
    
    return () => {
      window.removeEventListener('room-deleted', handleRoomDeleted);
    };
  }, [roomId, navigate]);
  
  // Request sync when connected and initialized
  useEffect(() => {
    if (isConnected && socket && isInitialized && !isEditable) {
      console.log('Requesting sync for room:', roomId);
      socket.emit('request-sync', { roomId });
    }
  }, [isConnected, socket, roomId, isInitialized, isEditable]);
  
  // Socket event listeners
  useEffect(() => {
    if (!isConnected || !socket) return;

    const handleCodeUpdate = ({ code: newCode }) => {
      console.log('Received code update:', newCode);
      if (!isEditableRef.current && newCode !== undefined) {
        dispatch(setCode(newCode));
      }
    };

    const handleOutputUpdate = ({ output: newOutput }) => {
      console.log('Received output update:', newOutput);
      if (newOutput !== undefined) {
        dispatch(setOutput(newOutput));
      }
    };
    
    const handleLanguageUpdate = ({ language: newLanguage }) => {
      console.log('Received language update:', newLanguage);
      if (newLanguage !== undefined) {
        dispatch(setLanguage(newLanguage));
      }
    };

    const handleInputUpdate = ({ input: newInput }) => {
      console.log('Received input update:', newInput);
      if (newInput !== undefined) {
        dispatch(setInput(newInput));
      }
    };

    const handleTestCaseCreated = ({ testCase }) => {
      if (testCase && testCase.id) {
        refetchTestCases();
        setSuccess(`New test case: ${testCase.title}`);
        setNewTestCases(prev => ({ ...prev, [testCase.id]: true }));
        
        // Auto-select if no test case selected
        if (!selectedTestCase) {
          handleTestCaseSelect(testCase);
        }
        
        setTimeout(() => setSuccess(null), 3000);
        setTimeout(() => {
          setNewTestCases(prev => {
            const updated = { ...prev };
            delete updated[testCase.id];
            return updated;
          });
        }, 10000);
      }
    };

    const handleSyncState = ({ code: syncCode, input: syncInput, output: syncOutput, language: syncLanguage }) => {
      console.log('Received sync state:', { syncCode, syncInput, syncOutput, syncLanguage });
      
      // Only update if not in editable mode
      if (!isEditableRef.current) {
        if (syncCode !== undefined) dispatch(setCode(syncCode));
        if (syncInput !== undefined) dispatch(setInput(syncInput));
        if (syncOutput !== undefined) dispatch(setOutput(syncOutput));
        if (syncLanguage !== undefined) dispatch(setLanguage(syncLanguage));
      }
    };

    // Register all event listeners
    socket.on('code-update', handleCodeUpdate);
    socket.on('output-update', handleOutputUpdate);
    socket.on('language-update', handleLanguageUpdate);
    socket.on('input-update', handleInputUpdate);
    socket.on('test-case-created', handleTestCaseCreated);
    socket.on('sync-state', handleSyncState);

    console.log('Socket event listeners registered');

    return () => {
      socket.off('code-update', handleCodeUpdate);
      socket.off('output-update', handleOutputUpdate);
      socket.off('language-update', handleLanguageUpdate);
      socket.off('input-update', handleInputUpdate);
      socket.off('test-case-created', handleTestCaseCreated);
      socket.off('sync-state', handleSyncState);
      console.log('Socket event listeners cleaned up');
    };
  }, [isConnected, socket, dispatch, selectedTestCase, refetchTestCases]);
  
  // Timer
  useEffect(() => {
    let timer;
    if (startTime && isEditable) {
      timer = setInterval(() => {
        setElapsedTime(Math.floor((new Date() - startTime) / 1000));
      }, 1000);
    }
    return () => timer && clearInterval(timer);
  }, [startTime, isEditable]);
  
  // Handle test case selection
  const handleTestCaseSelect = useCallback((testCase) => {
    setSelectedTestCase(testCase);
    dispatch(setInput(testCase.input || ''));
    setActiveTab('broadcast');
    
    // Remove new status
    setNewTestCases(prev => {
      const updated = { ...prev };
      delete updated[testCase.id];
      return updated;
    });
  }, [dispatch]);
  
  // Start solving
  const handleSolve = useCallback(() => {
    if (!selectedTestCase) {
      setError('Please select a test case first');
      return;
    }
    
    dispatch(setEditable(true));
    dispatch(setTestCase(selectedTestCase));
    setStudentCode(code || `// Solve: ${selectedTestCase.title}\n// Your code here\n`);
    setStudentOutput(''); // Clear previous student output
    setStartTime(new Date());
    setElapsedTime(0);
    setActiveTab('solve');
    setSuccess('You can now edit and submit your solution');
  }, [selectedTestCase, dispatch, code]);
  
  // Handle tab change with sync request
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    
    // If switching to broadcast tab and not editable, request sync
    if (tab === 'broadcast' && !isEditable && isConnected && socket) {
      console.log('Tab changed to broadcast, requesting sync');
      socket.emit('request-sync', { roomId });
    }
  }, [isEditable, isConnected, socket, roomId]);
  
  // Handle student code change
  const handleStudentCodeChange = useCallback((value) => {
    setStudentCode(value);
  }, []);
  
  // Helper function to get valid language ID
  const getValidLanguageId = (languageValue) => {
    // Handle different language value formats
    let languageId;
    
    if (typeof languageValue === 'number') {
      languageId = languageValue;
    } else if (typeof languageValue === 'string') {
      // Try to parse as number
      const parsed = parseInt(languageValue, 10);
      if (!isNaN(parsed)) {
        languageId = parsed;
      } else {
        // Handle string language names - map to common language IDs
        const languageMap = {
          'javascript': 63,
          'python': 71,
          'java': 62,
          'cpp': 54,
          'c': 50,
          'csharp': 51,
          'php': 68,
          'ruby': 72,
          'go': 60,
          'rust': 73,
          'kotlin': 78,
          'swift': 83,
          'typescript': 74,
          'scala': 81,
          'perl': 85,
          'r': 80,
          'dart': 90,
          'elixir': 57,
          'haskell': 61,
          'lua': 64,
          'objectivec': 79,
          'sql': 82,
          'bash': 46,
          'clojure': 86,
          'cobol': 77,
          'erlang': 58,
          'fortran': 59,
          'groovy': 88,
          'julia': 79,
          'lisp': 55,
          'matlab': 70,
          'ocaml': 65,
          'pascal': 67,
          'prolog': 69,
          'vb': 84
        };
        
        languageId = languageMap[languageValue.toLowerCase()];
      }
    }
    
    // Default to JavaScript if no valid language found
    if (!languageId || isNaN(languageId) || languageId <= 0) {
      console.warn('Invalid language, defaulting to JavaScript (63):', languageValue);
      languageId = 63; // JavaScript
    }
    
    return languageId;
  };
  
  // Run student code
  const handleRunCode = async () => {
    if (!((studentCode || '')?.trim() || '')) {
      setError('Please write some code first');
      return;
    }
    
    setError(null);
    setStudentOutput('Running code...');
    
    try {
      // Get valid language ID with fallback
      const languageId = getValidLanguageId(language);
      
      console.log('Language validation:', {
        original: language,
        type: typeof language,
        converted: languageId
      });

      // Get the test case input
      const testInput = selectedTestCase?.input || '';
      
      console.log('Running code with:', {
        language_id: languageId,
        source_code: studentCode,
        stdin: testInput,
      });

      try {
        const result = await runCode({
          language_id: languageId,
          source_code: studentCode,
          stdin: testInput,
        }).unwrap();
        
        console.log('Code execution result:', result);
        
        // Handle the response
        let outputText = '';
        
        if (result.stdout) {
          outputText = result.stdout;
        } else if (result.stderr) {
          outputText = `Error: ${result.stderr}`;
        } else if (result.compile_output) {
          outputText = `Compilation Error: ${result.compile_output}`;
        } else if (result.message) {
          outputText = `System: ${result.message}`;
        } else {
          outputText = 'No output';
        }
        
        setStudentOutput(outputText);
        
        // Check if matches expected output
        if (selectedTestCase && selectedTestCase.expectedOutput) {
          const actualOutput = (outputText || '')?.trim() || '';
          const expectedOutput = (selectedTestCase?.expectedOutput || '')?.trim() || '';
          
          if (actualOutput === expectedOutput) {
            setSuccess('✅ Output matches! You can submit your solution.');
          } else {
            setSuccess('⚠️ Output doesn\'t match expected result. Keep trying!');
            console.log('Output mismatch:', {
              expected: expectedOutput,
              actual: actualOutput
            });
          }
        } else {
          setSuccess('Code executed successfully!');
        }
      } catch (apiError) {
        console.error('API error running code:', apiError);
        
        // Extract error details from the response if available
        let errorMessage = 'Failed to run code';
        
        if (apiError?.data?.message) {
          errorMessage = apiError.data.message;
        } else if (apiError?.data?.error) {
          errorMessage = apiError.data.error;
        } else if (apiError?.message) {
          errorMessage = apiError.message;
        } else if (apiError?.status === 500) {
          errorMessage = 'Server error - please try again';
        } else if (apiError?.status === 400) {
          errorMessage = 'Invalid request - check your code and language selection';
        } else if (apiError?.status) {
          errorMessage = `Request failed with status ${apiError.status}`;
        }
        
        setStudentOutput(`Error: ${errorMessage}`);
        setError(`Failed to run code: ${errorMessage}`);
      }
      
    } catch (err) {
      console.error('Unexpected error running code:', err);
      const errorMessage = err?.message || 'An unexpected error occurred';
      setStudentOutput(`Fatal Error: ${errorMessage}`);
      setError(`Failed to run code: ${errorMessage}`);
    }
  };

  // Submit solution
  const handleSubmit = async () => {
    // Validate inputs
    if (!((studentCode || '')?.trim() || '')) {
      setError('Please write some code before submitting.');
      return;
    }
    
    if (!testCase) {
      setError('Please select a test case before submitting.');
      return;
    }
    
    // Calculate time taken
    const timeTaken = startTime ? Math.floor((new Date() - startTime) / 1000) : 0;
    
    // Clear previous messages
    setError(null);
    setSuccess(null);
    
    try {
      // Use the same language validation for submission
      const validLanguageId = getValidLanguageId(language);
      
      if (!validLanguageId) {
        setError('Invalid programming language selected.');
        return;
      }
      
      try {
        const result = await createSubmission({
          testCaseId: testCase.id,
          code: studentCode,
          language: validLanguageId, // Use validated language ID
          timeTaken,
        }).unwrap();
        
        console.log('Submission result:', result);
        
        // Check submission status
        const status = result.submission?.status || 'Unknown';
        
        if (status === 'Solved') {
          setSuccess('🎉 Correct solution! Submitted successfully!');
          // Emit to teacher if socket is connected
          if (socket && socket.connected) {
            try {
              socket.emit('student-submission-update', { 
                roomId, 
                status: 'solved',
                testCaseId: testCase.id,
                testCaseTitle: testCase.title,
                studentName: 'Student', // Add student name if available
                timeTaken,
                submissionId: result.submission.id
              });
            } catch (socketError) {
              console.error('Socket emission error:', socketError);
              // Non-critical error, continue with submission process
            }
          }
          // Reset state
          dispatch(setEditable(false));
          dispatch(setTestCase(null));
          setStudentOutput(''); // Clear student output
          setStartTime(null);
          setElapsedTime(0);
          setActiveTab('broadcast');
          refetchSubmissions();
          
          // Request sync after switching back to broadcast
          if (isConnected && socket) {
            setTimeout(() => {
              socket.emit('request-sync', { roomId });
            }, 500);
          }
        } else {
          setSuccess('❌ Incorrect solution. Submitted! Try again!');
          // Emit failed attempt
          if (socket && socket.connected) {
            socket.emit('student-submission-update', { 
              roomId, 
              status: 'failed',
              testCaseId: testCase.id,
              testCaseTitle: testCase.title,
              timeTaken,
              submissionId: result.submission.id
            });
          }
        }
      } catch (apiError) {
        console.error('API error during submission:', apiError);
        
        // Extract error details from the response if available
        let errorMessage = 'Failed to submit solution';
        
        if (apiError.data?.error) {
          errorMessage = apiError.data.error;
          if (apiError.data.details) {
            errorMessage += `: ${apiError.data.details}`;
          }
        } else if (apiError.error) {
          errorMessage = apiError.error;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Unexpected submission error:', err);
      setError(err?.data?.message || 'An unexpected error occurred during submission');
    }
  };

  // Get solved test case IDs from submissions
  const getSolvedTestCaseIds = () => {
    if (!submissions || !Array.isArray(submissions)) return new Set();
    return new Set(
      submissions
        .filter(submission => submission.status === 'Solved')
        .map(submission => submission.testCaseId)
    );
  };

  const solvedTestCaseIds = getSolvedTestCaseIds();

  // Calculate statistics
  const getStatistics = () => {
    if (!submissions || !Array.isArray(submissions)) {
      return { totalActive: testCases?.length || 0, totalAttempted: 0, totalSolved: 0 };
    }

    const uniqueTestCases = new Set(submissions.map(s => s.testCaseId));
    const solvedTestCases = new Set(
      submissions.filter(s => s.status === 'Solved').map(s => s.testCaseId)
    );

    return {
      totalActive: testCases?.length || 0,
      totalAttempted: uniqueTestCases.size,
      totalSolved: solvedTestCases.size
    };
  };

  const statistics = getStatistics();

  // Determine which output to show
  const getCurrentOutput = () => {
    if (activeTab === 'solve' && isEditable) {
      return studentOutput;
    }
    return output; // Teacher's broadcast output
  };

  return (
    <div className="container mx-auto px-4 py-3">
      <div className="mb-4">
        <div className="flex items-center flex-wrap gap-2">
          <span className="bg-blue-600 text-white rounded-md px-3 py-2">
            Student Room: {roomId}
          </span>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            {!isConnected && (
              <button
                onClick={reconnect}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Timer */}
          {isEditable && startTime && (
            <div className="text-xs bg-green-100 px-2 py-1 rounded flex items-center">
              <span>⏱️ {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
            </div>
          )}
          
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelector
              value={language}
              onChange={(value) => dispatch(setLanguage(value))}
              disabled={!isEditable}
            />
            <button
              onClick={() => navigate('/student')}
              className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
            >
              Leave Room
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
          {/* Tab Navigation */}
          <div className="mb-4">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'broadcast' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => handleTabChange('broadcast')}
                >
                  Teacher's Code {!isConnected && '(Offline)'}
                </button>
                <button
                  className={`py-2 px-4 border-b-2 font-medium text-sm ${
                    activeTab === 'solve' 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => handleTabChange('solve')}
                  disabled={!isEditable}
                >
                  Your Solution {isEditable ? '✓' : '🔒'}
                </button>
              </nav>
            </div>
            
            {/* Code Editor */}
            <div className="border border-gray-200 rounded-lg shadow-sm mt-4">
              <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
                <span>
                  {activeTab === 'broadcast' ? "Teacher's Code (Read-Only)" : "Your Solution"}
                </span>
                <div className="flex items-center gap-2">
                  {activeTab === 'broadcast' && (
                    <span className={`text-xs px-2 py-1 rounded text-white ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {isConnected ? 'Live' : 'Offline'}
                    </span>
                  )}
                  {activeTab === 'solve' && testCase && (
                    <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded">
                      Solving: {testCase.title}
                    </span>
                  )}
                </div>
              </div>
              <CodeEditor
                value={activeTab === 'broadcast' ? code : studentCode}
                onChange={activeTab === 'broadcast' ? () => {} : handleStudentCodeChange}
                language={language}
                readOnly={activeTab === 'broadcast'}
                height="400px"
              />
            </div>
          </div>

          {/* Test Case Information */}
          <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
            <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
              <span>Test Case Information</span>
              {!isEditable && selectedTestCase && (
                <button
                  className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded"
                  onClick={handleSolve}
                >
                  Start Solving
                </button>
              )}
            </div>
            <div className="p-4">
              {selectedTestCase ? (
                <>
                  <h6 className="font-medium mb-2">Challenge: {selectedTestCase.title}</h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Input:</label>
                      <textarea
                        rows={3}
                        value={selectedTestCase.input || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Expected Output:</label>
                      <textarea
                        rows={3}
                        value={selectedTestCase.expectedOutput || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                      />
                    </div>
                  </div>
                  
                  {isEditable && activeTab === 'solve' && (
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {startTime && `Time: ${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')}`}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleRunCode}
                          disabled={isRunning || !((studentCode || '')?.trim() || '')}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded disabled:bg-yellow-300 disabled:cursor-not-allowed"
                        >
                          {isRunning ? 'Running...' : 'Test Code'}
                        </button>
                        <button
                          onClick={handleSubmit}
                          disabled={isSubmitting || !((studentCode || '')?.trim() || '')}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:bg-green-300 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>Select a test case to get started</p>
                  <p className="text-sm mt-1">Choose from the available test cases on the right</p>
                </div>
              )}
            </div>
          </div>

          {/* Output */}
          <div className="border border-gray-200 rounded-lg shadow-sm">
            <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
              <span className="text-gray-600">Output</span>
              {activeTab === 'broadcast' && (
                <span className="text-xs text-gray-500">Teacher's Output</span>
              )}
              {activeTab === 'solve' && (
                <span className="text-xs text-gray-500">Your Code Output</span>
              )}
            </div>
            <div className="p-4">
              <textarea
                rows={4}
                value={getCurrentOutput()}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono"
                placeholder="Output will appear here after running code"
              />
              {selectedTestCase && activeTab === 'solve' && studentOutput && (
                <div className="mt-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Expected vs Actual:</span>
                    <span className={`font-medium ${
                      ((studentOutput || '')?.trim() || '') === ((selectedTestCase?.expectedOutput || '')?.trim() || '') 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {((studentOutput || '')?.trim() || '') === ((selectedTestCase?.expectedOutput || '')?.trim() || '') ? 'MATCH ✓' : 'NO MATCH ✗'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Progress & Test Cases */}
        <div className="w-full lg:w-1/3 px-2">
          {/* Progress */}
          <div className="border border-gray-200 rounded-lg shadow-sm mb-4">
            <div className="bg-gray-100 py-2 px-4">
              <span className="text-gray-600">Your Progress</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-blue-50 p-3 rounded text-center">
                  <div className="text-xl font-bold text-blue-600">{statistics.totalActive}</div>
                  <div className="text-xs text-gray-600">Active</div>
                  <div className="text-xs text-gray-500">(Last {submissions?.activeTimeWindowMinutes || 30} min)</div>
                </div>
                <div className="bg-yellow-50 p-3 rounded text-center">
                  <div className="text-xl font-bold text-yellow-600">{statistics.totalAttempted}</div>
                  <div className="text-xs text-gray-600">Attempted</div>
                </div>
                <div className="bg-green-50 p-3 rounded text-center">
                  <div className="text-xl font-bold text-green-600">{statistics.totalSolved}</div>
                  <div className="text-xs text-gray-600">Solved</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-500" 
                  style={{ 
                    width: `${statistics.totalActive > 0 ? (statistics.totalSolved / statistics.totalActive) * 100 : 0}%` 
                  }}
                />
              </div>
              <div className="text-xs text-center text-gray-500">
                {statistics.totalSolved} of {statistics.totalActive} completed
                {statistics.totalActive > 0 && (
                  <span className="ml-1">
                    ({Math.round((statistics.totalSolved / statistics.totalActive) * 100)}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Available Test Cases */}
          <div className="border border-gray-200 rounded-lg shadow-sm">
            <div className="bg-gray-100 py-2 px-4 flex justify-between items-center">
              <span className="text-gray-600">Test Cases ({testCases?.length || 0})</span>
              <button
                onClick={refetchTestCases}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                title="Refresh test cases"
              >
                🔄
              </button>
            </div>
            <div className="p-4">
              {!testCases || testCases.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-4xl mb-2">📝</div>
                  <p className="font-medium">No test cases available</p>
                  <p className="text-sm mt-1">Wait for your teacher to publish test cases</p>
                  <button
                    onClick={refetchTestCases}
                    className="mt-3 bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
                  >
                    Check for Updates
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {testCases.map((tc, index) => {
                    const isNew = newTestCases[tc.id];
                    const isSolved = solvedTestCaseIds.has(tc.id);
                    const isSelected = selectedTestCase?.id === tc.id;
                    
                    return (
                      <button
                        key={tc.id}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                          isSelected 
                            ? 'bg-blue-500 text-white border-blue-600 shadow-lg transform scale-105' 
                            : isNew 
                              ? 'bg-yellow-50 border-yellow-400 hover:bg-yellow-100 animate-pulse' 
                              : isSolved
                                ? 'bg-green-50 border-green-300 hover:bg-green-100'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                        onClick={() => handleTestCaseSelect(tc)}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-sm">
                            {index + 1}. {tc.title}
                          </span>
                          <div className="flex gap-1">
                            {isNew && (
                              <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full animate-pulse font-bold">
                                NEW
                              </span>
                            )}
                            {isSolved && (
                              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-bold">
                                ✓ SOLVED
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-xs bg-blue-700 text-white px-2 py-1 rounded-full font-bold">
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`text-xs ${isSelected ? 'opacity-90' : 'opacity-75'}`}>
                          <div className="truncate">
                            <strong>Expected:</strong> {tc.expectedOutput?.substring(0, 40)}
                            {tc.expectedOutput?.length > 40 && '...'}
                          </div>
                          <div className="mt-1 text-gray-500">
                            Created: {new Date(tc.createdAt).toLocaleTimeString()}
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
  );
};

export default StudentRoom;