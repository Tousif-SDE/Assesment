import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setCode, setInput, setOutput, setLanguage, setEditable, setRoomId } from '../../redux/slices/editorSlice'
import { useRunCodeMutation } from '../../redux/api/codeApi'
import CodeEditor from '../../components/editor/CodeEditor'
import LanguageSelector from '../../components/editor/LanguageSelector'
import useSocket from '../../hooks/useSocket'
import axios from 'axios'
import { 
  Container, Row, Col, Card, Button, Alert, Badge, Form, Spinner
} from 'react-bootstrap'
import { Play, CheckCircle, Send, Clock, Terminal, Target, ArrowLeft, Check, X } from 'lucide-react'

// FIXED: Language ID mapping for Judge0 API
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
  
  console.log('Getting language ID for:', language, 'Result:', languageMap[language])
  return languageMap[language] || 71 // Default to Python if not found
}

// FIXED: Language templates with proper syntax
const getLanguageTemplate = (language) => {
  const templates = {
    javascript: `// Write your solution here
function solve() {
    // Your code here
    // Read from input if needed
    console.log("Your output here");
}

solve();`,
    
    python: `# Write your solution here
# Read input if needed: input_data = input().strip()
# Process and print output
print("Your output here")`,
    
    java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
        // Read input: String input = sc.nextLine();
        System.out.println("Your output here");
        sc.close();
    }
}`,
    
    cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    // Write your solution here
    // Read input: string input; getline(cin, input);
    cout << "Your output here" << endl;
    return 0;
}`,
    
    c: `#include <stdio.h>
#include <string.h>

int main() {
    // Write your solution here
    // Read input: char input[1000]; fgets(input, sizeof(input), stdin);
    printf("Your output here\\n");
    return 0;
}`,

    csharp: `using System;

class Program {
    static void Main() {
        // Write your solution here
        // Read input: string input = Console.ReadLine();
        Console.WriteLine("Your output here");
    }
}`,

    go: `package main

import "fmt"

func main() {
    // Write your solution here
    // Read input: var input string; fmt.Scanln(&input)
    fmt.Println("Your output here")
}`,

    php: `<?php
// Write your solution here
// Read input: $input = trim(fgets(STDIN));
echo "Your output here\\n";
?>`,

    ruby: `# Write your solution here
# Read input: input = gets.chomp
puts "Your output here"`,

    rust: `use std::io;

fn main() {
    // Write your solution here
    // Read input: let mut input = String::new(); io::stdin().read_line(&mut input).unwrap();
    println!("Your output here");
}`,

    kotlin: `fun main() {
    // Write your solution here
    // Read input: val input = readLine()
    println("Your output here")
}`,

    swift: `import Foundation

// Write your solution here
// Read input: let input = readLine()
print("Your output here")`,

    typescript: `// Write your solution here
function solve(): void {
    // Your code here
    console.log("Your output here");
}

solve();`
  }
  
  return templates[language] || templates['javascript']
}

const StudentRoom = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { code, input, output, language, isEditable } = useSelector((state) => state.editor)

  // State management
  const [testCases, setTestCases] = useState([])
  const [selectedTestCase, setSelectedTestCase] = useState(null)
  const [studentCode, setStudentCode] = useState('')
  const [studentOutput, setStudentOutput] = useState('')
  const [studentInput, setStudentInput] = useState('')
  const [activeTab, setActiveTab] = useState('broadcast')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [testResults, setTestResults] = useState([])
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [solvedTestCases, setSolvedTestCases] = useState(new Set())
  const [currentStudentLanguage, setCurrentStudentLanguage] = useState('javascript')
  
  const token = localStorage.getItem('token')
  const [runCode] = useRunCodeMutation()
  const { isConnected, socket } = useSocket(roomId)

  // Initialize session
  useEffect(() => {
    if (roomId) {
      dispatch(setRoomId(roomId))
      if (!sessionStorage.getItem('sessionId')) {
        sessionStorage.setItem('sessionId', `student-${roomId}-${Date.now()}`)
      }
    }
  }, [roomId, dispatch])

  // Socket event handlers
  useEffect(() => {
    if (!isConnected || !socket) return

    const handleCodeUpdate = ({ code: newCode }) => {
      console.log('📥 Received code update:', newCode?.substring(0, 50) + '...')
      if (newCode !== undefined) {
        dispatch(setCode(newCode))
      }
    }

    const handleOutputUpdate = ({ output: newOutput }) => {
      console.log('📥 Received output update:', newOutput)
      if (newOutput !== undefined) {
        dispatch(setOutput(newOutput))
      }
    }
    
    const handleLanguageUpdate = ({ language: newLanguage }) => {
      console.log('📥 Received language update:', newLanguage)
      if (newLanguage !== undefined) {
        dispatch(setLanguage(newLanguage))
        if (!isEditable) {
          setCurrentStudentLanguage(newLanguage)
        }
      }
    }

    // FIXED: Handle input updates properly
    const handleInputUpdate = ({ input: newInput }) => {
      console.log('📥 Received input update:', newInput)
      if (newInput !== undefined) {
        dispatch(setInput(newInput))
        setStudentInput(newInput) // Always update student input
      }
    }

    const handleTestCaseCreated = ({ testCase }) => {
      console.log('📥 Received new test case:', testCase)
      if (!testCase || !testCase.id) return
      setTestCases(prev => [...prev, testCase])
      if (!selectedTestCase) {
        setSelectedTestCase(testCase)
        dispatch(setInput(testCase.input || ''))
        setStudentInput(testCase.input || '')
      }
    }

    const handleSyncState = ({ code: syncCode, input: syncInput, output: syncOutput, language: syncLanguage }) => {
      console.log('📥 Received sync state:', { syncCode: syncCode?.substring(0, 50) + '...', syncInput, syncOutput, syncLanguage })
      if (syncCode !== undefined) dispatch(setCode(syncCode))
      if (syncInput !== undefined) {
        dispatch(setInput(syncInput))
        if (!isEditable) setStudentInput(syncInput)
      }
      if (syncOutput !== undefined) dispatch(setOutput(syncOutput))
      if (syncLanguage !== undefined) {
        dispatch(setLanguage(syncLanguage))
        if (!isEditable) setCurrentStudentLanguage(syncLanguage)
      }
    }

    socket.on('code-update', handleCodeUpdate)
    socket.on('output-update', handleOutputUpdate)
    socket.on('language-update', handleLanguageUpdate)
    socket.on('input-update', handleInputUpdate)
    socket.on('test-case-created', handleTestCaseCreated)
    socket.on('sync-state', handleSyncState)

    return () => {
      socket.off('code-update', handleCodeUpdate)
      socket.off('output-update', handleOutputUpdate)
      socket.off('language-update', handleLanguageUpdate)
      socket.off('input-update', handleInputUpdate)
      socket.off('test-case-created', handleTestCaseCreated)
      socket.off('sync-state', handleSyncState)
    }
  }, [isConnected, socket, dispatch, isEditable, selectedTestCase])

  // Load test cases
  useEffect(() => {
    const loadTestCases = async () => {
      if (!roomId || !token) return
      
      try {
        const response = await axios.get(`http://localhost:5000/api/testcases/room/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.data && response.data.length > 0) {
          setTestCases(response.data)
          const firstTestCase = response.data[0]
          setSelectedTestCase(firstTestCase)
          dispatch(setInput(firstTestCase.input || ''))
          setStudentInput(firstTestCase.input || '')
        }
      } catch (error) {
        console.error('Failed to load test cases:', error)
        setError('Failed to load test cases.')
        setTimeout(() => setError(null), 3000)
      }
    }
    
    loadTestCases()
  }, [roomId, dispatch, token])

  // Timer for solving mode
  useEffect(() => {
    let interval = null
    if (startTime && isEditable) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [startTime, isEditable])

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

  // FIXED: Handle language changes for both modes
  const handleLanguageChange = (newLanguage) => {
    console.log('Language change requested:', newLanguage)
    
    // Validate the language
    const validLanguages = ['javascript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'php', 'ruby', 'rust', 'kotlin', 'swift', 'typescript']
    
    if (!validLanguages.includes(newLanguage)) {
      console.error('Invalid language:', newLanguage)
      return
    }

    if (isEditable) {
      // In solving mode, update student's language
      setCurrentStudentLanguage(newLanguage)
    } else {
      // In broadcast mode, update Redux language and student language
      dispatch(setLanguage(newLanguage))
      setCurrentStudentLanguage(newLanguage)
    }
    
    // Broadcast language change via socket
    if (socket && isConnected) {
      socket.emit('language-update', { 
        language: newLanguage, 
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('sessionId')
      })
    }
  }

  // FIXED: Handle input changes properly
  const handleInputChange = (e) => {
    const value = e.target.value
    console.log('Input change:', value)
    
    // Always update both Redux state and local state
    dispatch(setInput(value))
    setStudentInput(value)
    
    // Broadcast input changes to all clients (including teacher)
    if (socket && isConnected) {
      socket.emit('input-update', { 
        input: value, 
        timestamp: Date.now(),
        sessionId: sessionStorage.getItem('sessionId')
      })
    }
  }

  // Handle test case selection
  const handleTestCaseSelect = (testCase) => {
    console.log('Test case selected:', testCase)
    setSelectedTestCase(testCase)
    const testInput = testCase.input || ''
    dispatch(setInput(testInput))
    setStudentInput(testInput)
    setTestResults([])
    setStudentOutput('')
  }

  // FIXED: Start solving mode with proper template
  const handleSolve = () => {
    if (!selectedTestCase) return
    
    setActiveTab('solve')
    dispatch(setEditable(true))
    setStartTime(Date.now())
    setElapsedTime(0)
    setError(null)
    setSuccess(null)
    
    // Initialize student code with proper template
    if (!studentCode.trim()) {
      const template = getLanguageTemplate(currentStudentLanguage)
      setStudentCode(template)
    }

    // Set input from selected test case
    setStudentInput(selectedTestCase.input || '')
    
    console.log('Started solving mode:', {
      language: currentStudentLanguage,
      testCase: selectedTestCase.title,
      input: selectedTestCase.input
    })
  }

  // FIXED: Compare outputs with proper normalization
  const compareOutputs = (actual, expected) => {
    if (!actual && !expected) return true
    if (!actual || !expected) return false
    
    const normalizeOutput = (str) => {
      return str.toString().trim().replace(/\s+/g, ' ')
    }
    
    return normalizeOutput(actual) === normalizeOutput(expected)
  }

  // FIXED: Run code function with better error handling
  const handleRunCode = async () => {
    if (!studentCode?.trim()) {
      setError('Please write some code first')
      return
    }
    if (!selectedTestCase) {
      setError('Please select a test case first')
      return
    }

    const languageId = getLanguageId(currentStudentLanguage)
    if (!languageId) {
      setError(`Unsupported language: ${currentStudentLanguage}`)
      return
    }

    setIsRunningTests(true)
    setStudentOutput('Running against test cases...')
    setError(null)
    setSuccess(null)

    console.log('Executing code with:', {
      language: currentStudentLanguage,
      languageId: languageId,
      code: studentCode.substring(0, 100) + '...',
      input: studentInput
    })

    try {
      const response = await axios.post(
        'http://localhost:5000/api/code/run',
        {
          language_id: languageId,
          source_code: studentCode,
          stdin: studentInput || ''
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('Code execution response:', response.data)

      const result = response.data
      
      // Handle different response formats
      let actualOutput = ''
      if (result.stdout) {
        actualOutput = result.stdout.trim()
      } else if (result.output) {
        actualOutput = result.output.trim()
      }
      
      const expectedOutput = selectedTestCase.expectedOutput ? selectedTestCase.expectedOutput.trim() : ''
      const passed = compareOutputs(actualOutput, expectedOutput)

      const testResult = {
        input: studentInput,
        expectedOutput,
        actualOutput,
        passed,
        error: result.stderr || result.compile_output || null,
        status: result.status?.description || 'Unknown'
      }

      setTestResults([testResult])
      
      if (result.stderr || result.compile_output) {
        setStudentOutput(`Error: ${result.stderr || result.compile_output}`)
        setError(`Execution error: ${result.stderr || result.compile_output}`)
      } else {
        setStudentOutput(actualOutput || 'No output')
        
        if (passed) {
          setSuccess('✅ Test case passed! You can now submit your solution.')
        } else {
          setError(`❌ Test failed. Expected: "${expectedOutput}", Got: "${actualOutput}"`)
        }
      }

    } catch (err) {
      console.error('Code execution error:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to execute code'
      setError(`Execution failed: ${errorMessage}`)
      setStudentOutput('Execution failed')
    } finally {
      setIsRunningTests(false)
    }
  }

  // FIXED: Submit solution only if tests pass
  const handleSubmit = async () => {
    if (!studentCode?.trim() || !selectedTestCase) {
      setError('Please write code and select a test case before submitting')
      return
    }

    if (testResults.length === 0 || !testResults.every(r => r.passed)) {
      setError('All test cases must pass before you can submit. Please fix your code.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/submissions',
        {
          testCaseId: selectedTestCase.id,
          code: studentCode,
          language: getLanguageId(currentStudentLanguage)
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.status === 201) {
        setSolvedTestCases(prev => new Set([...prev, selectedTestCase.id]))
        setSuccess('🎉 Solution submitted successfully!')
        
        setStartTime(null)
        dispatch(setEditable(false))
        setActiveTab('broadcast')
      }
    } catch (err) {
      console.error('Submission error:', err)
      setError('Failed to submit solution. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  

  return (
    <div className="d-flex flex-column min-vh-100" style={{ background: '#f5f5f9' }}>
      {/* Header */}
      <div className="position-fixed w-100 bg-white shadow-sm" style={{ top: 0, zIndex: 1000, height: '70px' }}>
        <div className="d-flex align-items-center justify-content-between px-4 h-100">
          <div className="d-flex align-items-center">
            <Button variant="link" className="p-0 me-3" onClick={() => navigate('/student')}>
              <ArrowLeft size={20} />
            </Button>
            <h4 className="mb-0 fw-bold">Live Coding Session</h4>
            <Badge className="ms-3 px-3 py-2" style={{ background: '#8b5cf6' }}>
              Room: {roomId?.substring(0, 8)}...
            </Badge>
            <div className="d-flex align-items-center ms-3">
              <div className={`rounded-circle me-2 ${isConnected ? 'bg-success' : 'bg-warning'}`} style={{ width: '8px', height: '8px' }}></div>
              <span className="fw-semibold">{isConnected ? 'Live' : 'Connecting...'}</span>
            </div>
          </div>
          
          <div className="d-flex align-items-center gap-3">
            {isEditable && startTime && (
              <Badge className="px-3 py-2 d-flex align-items-center" style={{ background: '#8b5cf6' }}>
                <Clock size={16} className="me-2" />
                {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
              </Badge>
            )}
            <LanguageSelector 
              value={isEditable ? currentStudentLanguage : language} 
              onChange={handleLanguageChange} 
              disabled={false}
            />
            <Button variant="outline-danger" onClick={() => navigate('/student')}>
              Leave Room
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="position-fixed" style={{ 
          top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 999, maxWidth: '600px'
        }}>
          <Alert variant="danger" className="text-center">{error}</Alert>
        </div>
      )}

      {success && (
        <div className="position-fixed" style={{ 
          top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 999, maxWidth: '600px'
        }}>
          <Alert variant="success" className="text-center">{success}</Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-grow-1" style={{ paddingTop: '85px', paddingBottom: '20px' }}>
        <Container fluid className="px-4">
          <Row className="g-4">
            {/* Code Editor */}
            <Col lg={8}>
              <Card className="border-0 shadow-sm">
                <div className="px-4 py-3" style={{ background: '#8b5cf6', color: 'white' }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="p-2 rounded me-3" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                        <i className="bi bi-code-square" style={{ fontSize: '20px' }}></i>
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">Code Editor</h6>
                        <small className="opacity-75">
                          {isConnected ? 'Live' : 'Offline'} • Language: {isEditable ? currentStudentLanguage : language}
                        </small>
                      </div>
                    </div>
                    
                    <div className="btn-group">
                      <Button 
                        variant={activeTab === 'broadcast' ? 'light' : 'outline-light'} 
                        onClick={() => setActiveTab('broadcast')}
                        size="sm"
                      >
                        Teacher's Code
                      </Button>
                      <Button 
                        variant={activeTab === 'solve' ? 'light' : 'outline-light'} 
                        onClick={() => setActiveTab('solve')} 
                        disabled={!isEditable}
                        size="sm"
                      >
                        Your Solution {!isEditable && '🔒'}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div style={{ height: '400px' }}>
                  <CodeEditor
                    value={activeTab === 'broadcast' ? code : studentCode}
                    onChange={activeTab === 'broadcast' ? () => {} : setStudentCode}
                    language={activeTab === 'broadcast' ? language : currentStudentLanguage}
                    readOnly={activeTab === 'broadcast'}
                    height="400px"
                  />
                </div>
              </Card>
            </Col>

            {/* Input & Output */}
            <Col lg={4}>
              <Card className="border-0 shadow-sm">
                <div className="px-3 py-2 text-white fw-bold d-flex align-items-center" style={{ background: '#8b5cf6' }}>
                  <Terminal size={16} className="me-2" />
                  Input & Output
                </div>
                
                <div className="p-3">
                  <div className="mb-3">
                    <div className="px-3 py-2 fw-semibold text-white d-flex justify-content-between" style={{ background: '#8b5cf6', fontSize: '12px' }}>
                      <span>INPUT</span>
                      {selectedTestCase && (
                        <span className="opacity-75">{selectedTestCase.title}</span>
                      )}
                    </div>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      value={isEditable ? studentInput : input}
                      onChange={handleInputChange}
                      readOnly={!isEditable}
                      placeholder={isEditable ? "Enter your test input..." : "Input from teacher..."}
                      style={{ fontFamily: 'monospace', fontSize: '13px', resize: 'none', backgroundColor: isEditable ? 'white' : '#f8f9fa' }}
                    />
                  </div>

                  <div className="mb-3">
                    <div className="px-3 py-2 fw-semibold text-white d-flex justify-content-between" style={{ background: '#8b5cf6', fontSize: '12px' }}>
                      <span>OUTPUT</span>
                      {testResults.length > 0 && (
                        <Badge bg={testResults.every(r => r.passed) ? "success" : "danger"}>
                          {testResults.every(r => r.passed) ? '✓ PASSED' : '✗ FAILED'}
                        </Badge>
                      )}
                    </div>
                    <div
                      style={{
                        background: testResults.length > 0 ? 
                          (testResults.every(r => r.passed) ? '#f0f9ff' : '#fef2f2') : '#f9fafb',
                        border: `2px solid ${testResults.length > 0 ? 
                          (testResults.every(r => r.passed) ? '#10b981' : '#ef4444') : '#e0e7ff'}`,
                        padding: '10px',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        minHeight: '120px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {activeTab === 'solve' && isEditable ? studentOutput : output || 'Output will appear here...'}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isEditable && activeTab === 'solve' && (
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-primary"
                        onClick={handleRunCode}
                        disabled={isRunningTests || !studentCode?.trim()}
                        className="flex-grow-1"
                      >
                        {isRunningTests ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play size={16} className="me-2" />
                            Run Tests
                          </>
                        )}
                      </Button>

                      <Button
                        variant={testResults.length > 0 && testResults.every(r => r.passed) ? "success" : "secondary"}
                        onClick={handleSubmit}
                        disabled={!studentCode?.trim() || isRunningTests || isSubmitting || 
                                 testResults.length === 0 || !testResults.every(r => r.passed)}
                        className="flex-grow-1"
                      >
                        {isSubmitting ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Submitting...
                          </>
                        ) : testResults.length > 0 && testResults.every(r => r.passed) ? (
                          <>
                            <Send size={16} className="me-2" />
                            Submit ✓
                          </>
                        ) : (
                          <>
                            <Send size={16} className="me-2" />
                            Submit
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Test Cases Section */}
          <Row className="mt-4">
            <Col xs={12}>
              <Card className="border-0 shadow-sm">
                <div className="px-4 py-3" style={{ background: '#8b5cf6', color: 'white' }}>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <div className="p-2 rounded me-3" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                        <Target size={20} />
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">Problem Test Cases</h6>
                        <small className="opacity-75">
                          Select a test case to start solving • Solved: {solvedTestCases.size}/{testCases.length}
                        </small>
                      </div>
                    </div>
                    
                    {testCases.length > 0 && (
                      <Badge style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                        {testCases.length} Test Case{testCases.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="p-4">
                  {testCases.length === 0 ? (
                    <div className="text-center py-5">
                      <h6 className="text-muted">No test cases available</h6>
                      <p className="text-muted mb-0">Waiting for teacher to create test cases...</p>
                    </div>
                  ) : (
                    <Row className="g-3">
                      {testCases.map((testCase, index) => (
                        <Col md={6} lg={4} key={testCase.id}>
                          <Card 
                            className={`h-100 cursor-pointer border-2 ${
                              selectedTestCase?.id === testCase.id 
                                ? 'border-primary bg-primary bg-opacity-10' 
                                : 'border-light'
                            }`}
                            onClick={() => handleTestCaseSelect(testCase)}
                            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                          >
                            <Card.Body className="p-3">
                              <div className="d-flex align-items-center justify-content-between mb-3">
                                <div className="d-flex align-items-center">
                                  <div 
                                    className={`rounded-circle d-flex align-items-center justify-content-center me-2 ${
                                      solvedTestCases.has(testCase.id) 
                                        ? 'bg-success' 
                                        : selectedTestCase?.id === testCase.id 
                                        ? 'bg-primary' 
                                        : 'bg-secondary'
                                    }`}
                                    style={{ width: '24px', height: '24px' }}
                                  >
                                    {solvedTestCases.has(testCase.id) ? (
                                      <Check size={14} className="text-white" />
                                    ) : (
                                      <span className="text-white fw-bold" style={{ fontSize: '11px' }}>
                                        {index + 1}
                                      </span>
                                    )}
                                  </div>
                                  <h6 className="mb-0 fw-bold">
                                    {testCase.title || `Test Case ${index + 1}`}
                                  </h6>
                                </div>
                                
                                {solvedTestCases.has(testCase.id) && (
                                  <Badge bg="success" className="px-2">✓ Solved</Badge>
                                )}
                              </div>

                              <div className="mb-2">
                                <small className="text-muted fw-semibold">Input:</small>
                                <div className="small bg-light p-2 rounded mt-1" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                  {testCase.input || 'No input'}
                                </div>
                              </div>

                              <div className="mb-3">
                                <small className="text-muted fw-semibold">Expected Output:</small>
                                <div className="small bg-light p-2 rounded mt-1" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                                  {testCase.expectedOutput || 'No expected output'}
                                </div>
                              </div>

                              <div className="d-flex gap-2">
                                <Button
                                  size="sm"
                                  variant={selectedTestCase?.id === testCase.id ? 'primary' : 'outline-primary'}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleTestCaseSelect(testCase)
                                  }}
                                  className="flex-grow-1"
                                >
                                  {selectedTestCase?.id === testCase.id ? 'Selected' : 'Select'}
                                </Button>
                                
                                {selectedTestCase?.id === testCase.id && !solvedTestCases.has(testCase.id) && (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSolve()
                                    }}
                                    disabled={isEditable}
                                  >
                                    {isEditable ? 'Solving...' : 'Solve'}
                                  </Button>
                                )}
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Test Results Section */}
          {testResults.length > 0 && (
            <Row className="mt-4">
              <Col xs={12}>
                <Card className="border-0 shadow-sm">
                  <div className="px-4 py-3" style={{ 
                    background: testResults.every(r => r.passed) ? '#10b981' : '#ef4444', 
                    color: 'white' 
                  }}>
                    <div className="d-flex align-items-center">
                      <div className="p-2 rounded me-3" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
                        {testResults.every(r => r.passed) ? <CheckCircle size={20} /> : <X size={20} />}
                      </div>
                      <div>
                        <h6 className="mb-0 fw-bold">
                          Test Results: {testResults.every(r => r.passed) ? 'All Passed ✅' : 'Failed ❌'}
                        </h6>
                        <small className="opacity-75">
                          {testResults.filter(r => r.passed).length}/{testResults.length} test cases passed
                        </small>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {testResults.map((result, index) => (
                      <Card key={index} className={`mb-3 border-2 ${result.passed ? 'border-success' : 'border-danger'}`}>
                        <Card.Body className="p-3">
                          <div className="d-flex align-items-center justify-content-between mb-3">
                            <h6 className="mb-0 fw-bold d-flex align-items-center">
                              {result.passed ? (
                                <Check className="text-success me-2" size={16} />
                              ) : (
                                <X className="text-danger me-2" size={16} />
                              )}
                              Test Case {index + 1}: {result.passed ? 'Passed' : 'Failed'}
                            </h6>
                            <Badge bg={result.passed ? 'success' : 'danger'}>
                              {result.passed ? '✓ PASS' : '✗ FAIL'}
                            </Badge>
                          </div>
                          
                          <Row>
                            <Col md={4}>
                              <small className="text-muted fw-semibold">Input:</small>
                              <div className="bg-light p-2 rounded mt-1" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {result.input || 'No input'}
                              </div>
                            </Col>
                            <Col md={4}>
                              <small className="text-muted fw-semibold">Expected Output:</small>
                              <div className="bg-light p-2 rounded mt-1" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {result.expectedOutput || 'No expected output'}
                              </div>
                            </Col>
                            <Col md={4}>
                              <small className="text-muted fw-semibold">Your Output:</small>
                              <div 
                                className={`p-2 rounded mt-1 ${
                                  result.passed 
                                    ? 'bg-success bg-opacity-10 border border-success' 
                                    : 'bg-danger bg-opacity-10 border border-danger'
                                }`} 
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                              >
                                {result.actualOutput || 'No output'}
                              </div>
                            </Col>
                          </Row>
                          
                          {result.error && (
                            <div className="mt-3">
                              <small className="text-muted fw-semibold">Error:</small>
                              <div className="bg-danger bg-opacity-10 border border-danger p-2 rounded mt-1 text-danger" 
                                   style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                {result.error}
                              </div>
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </Container>
      </div>
    </div>
  )
}

export default StudentRoom