import { useEffect, useState, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import {  updateEditorState, setCode, setOutput, setLanguage, setInput } from '../redux/slices/editorSlice'

// Create socket instance with better configuration
let socket = null

const createSocket = () => {
  if (socket && socket.connected) {
    return socket
  }
  
  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    maxReconnectionAttempts: 10,
    randomizationFactor: 0.5,
    extraHeaders: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true'
    },
    forceNew: true,
  })
  
  return socket
}

const useSocket = (roomId) => {
  const dispatch = useDispatch()
  const [isConnected, setIsConnected] = useState(false)
  const [activeStudents, setActiveStudents] = useState([])
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [lastActivity, setLastActivity] = useState(Date.now())
  
  const { isEditable } = useSelector((state) => state.editor)
  const roomIdRef = useRef(roomId)
  const reconnectTimeoutRef = useRef(null)
  const heartbeatIntervalRef = useRef(null)
  const isEditableRef = useRef(isEditable)

  // Update refs when values change
  useEffect(() => {
    roomIdRef.current = roomId
    isEditableRef.current = isEditable
  }, [roomId, isEditable])

  // Heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket && socket.connected && roomIdRef.current) {
        socket.emit('heartbeat', { roomId: roomIdRef.current, timestamp: Date.now() })
        setLastActivity(Date.now())
      }
    }, 30000)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Enhanced connection function
  const connectSocket = useCallback(() => {
    if (!roomId) return

    try {
      socket = createSocket()
      
      // Connection event handlers
      const onConnect = () => {
        console.log('Socket connected:', socket.id)
        setIsConnected(true)
        setConnectionAttempts(0)
        
        // Join room immediately after connection
        if (roomIdRef.current) {
          socket.emit('join-room', { 
            roomId: roomIdRef.current,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            sessionId: sessionStorage.getItem('sessionId') || Date.now().toString()
          })
          
          // Start heartbeat
          startHeartbeat()
        }
      }

      const onDisconnect = (reason) => {
        console.log('Socket disconnected:', reason)
        setIsConnected(false)
        stopHeartbeat()
        
        // Auto-reconnect for certain disconnect reasons
        if (reason === 'io server disconnect') {
          setTimeout(() => {
            if (socket && roomIdRef.current) {
              socket.connect()
            }
          }, 1000)
        }
      }

      const onConnectError = (error) => {
        console.error('Socket connection error:', error)
        setIsConnected(false)
        setConnectionAttempts(prev => prev + 1)
        
        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 10000)
        reconnectTimeoutRef.current = setTimeout(() => {
          if (socket && !socket.connected) {
            socket.connect()
          }
        }, delay)
      }

      const onReconnect = (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts')
        setConnectionAttempts(0)
        
        // Re-join room after reconnection
        if (roomIdRef.current) {
          socket.emit('join-room', { 
            roomId: roomIdRef.current,
            timestamp: Date.now(),
            reconnected: true
          })
        }
      }

      const onReconnectError = (error) => {
        console.error('Socket reconnection error:', error)
        setConnectionAttempts(prev => prev + 1)
      }

      // Editor state update handlers
      const onCodeUpdate = ({ code, timestamp }) => {
        if (!isEditableRef.current && code !== undefined) {
          dispatch(setCode(code))
          setLastActivity(Date.now())
        }
      }

      const onOutputUpdate = ({ output, timestamp }) => {
        if (output !== undefined) {
          dispatch(setOutput(output))
          setLastActivity(Date.now())
        }
      }
      
      const onLanguageUpdate = ({ language, timestamp }) => {
        if (language !== undefined) {
          dispatch(setLanguage(language))
          setLastActivity(Date.now())
        }
      }

      const onInputUpdate = ({ input, timestamp }) => {
        if (input !== undefined) {
          dispatch(setInput(input))
          setLastActivity(Date.now())
        }
      }

      // Fixed: Ensure activeStudents is always an array
      const onStudentUpdate = ({ students, teachers, timestamp }) => {
        const studentsArray = Array.isArray(students) ? students : []
        const teachersArray = Array.isArray(teachers) ? teachers : []
        
        // Combine students and teachers for activeStudents
        const allUsers = [...studentsArray, ...teachersArray]
        setActiveStudents(allUsers)
        setLastActivity(Date.now())
      }
      
      const onTestCaseCreated = ({ testCase, timestamp }) => {
        if (testCase) {
          const event = new CustomEvent('test-case-created', { 
            detail: {
              ...testCase,
              timestamp: timestamp || new Date().toISOString(),
              isNew: true
            }
          })
          window.dispatchEvent(event)
          
          // Show notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Test Case', {
              body: `A new test case "${testCase.title || 'Untitled'}" has been published`,
              icon: '/favicon.ico',
              tag: 'test-case-' + testCase.id
            })
          }
          
          setLastActivity(Date.now())
        }
      }

      const onRoomJoined = ({ success, message, roomInfo }) => {
        console.log('Room joined:', { success, message, roomInfo })
        if (success && roomInfo) {
          // Initialize activeStudents with empty array if not provided
          setActiveStudents(Array.isArray(roomInfo.students) ? roomInfo.students : [])
        }
      }

      const onRoomError = ({ error, message }) => {
        console.error('Room error:', { error, message })
      }

      // Register all event listeners
      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('connect_error', onConnectError)
      socket.on('reconnect', onReconnect)
      socket.on('reconnect_error', onReconnectError)
      
      socket.on('code-update', onCodeUpdate)
      socket.on('html-update', onCodeUpdate)
      socket.on('css-update', onCodeUpdate)
      socket.on('js-update', onCodeUpdate)
      socket.on('output-update', onOutputUpdate)
      socket.on('language-update', onLanguageUpdate)
      socket.on('input-update', onInputUpdate)
      socket.on('student-update', onStudentUpdate)
      socket.on('test-case-created', onTestCaseCreated)
      socket.on('room-joined', onRoomJoined)
      socket.on('room-error', onRoomError)

      // Connect the socket
      if (!socket.connected) {
        socket.connect()
      }

      // Cleanup function
      return () => {
        stopHeartbeat()
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }

        // Remove event listeners
        socket.off('connect', onConnect)
        socket.off('disconnect', onDisconnect)
        socket.off('connect_error', onConnectError)
        socket.off('reconnect', onReconnect)
        socket.off('reconnect_error', onReconnectError)
        
        socket.off('code-update', onCodeUpdate)
        socket.off('html-update', onCodeUpdate)
        socket.off('css-update', onCodeUpdate)
        socket.off('js-update', onCodeUpdate)
        socket.off('output-update', onOutputUpdate)
        socket.off('language-update', onLanguageUpdate)
        socket.off('input-update', onInputUpdate)
        socket.off('student-update', onStudentUpdate)
        socket.off('test-case-created', onTestCaseCreated)
        socket.off('room-joined', onRoomJoined)
        socket.off('room-error', onRoomError)
        
        // Leave room
        if (roomIdRef.current && socket.connected) {
          socket.emit('leave-room', { 
            roomId: roomIdRef.current,
            timestamp: Date.now()
          })
        }
      }
    } catch (error) {
      console.error('Error setting up socket connection:', error)
      setIsConnected(false)
    }
  }, [roomId, startHeartbeat, stopHeartbeat, connectionAttempts])

  // Initialize socket connection
  useEffect(() => {
    if (!roomId) return

    const cleanup = connectSocket()
    
    return cleanup
  }, [roomId, connectSocket])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      if (socket && socket.connected) {
        if (roomIdRef.current) {
          socket.emit('leave-room', { 
            roomId: roomIdRef.current,
            timestamp: Date.now()
          })
        }
        socket.disconnect()
      }
    }
  }, [stopHeartbeat])

  // Enhanced emit functions with error handling and retry logic
  const createEmitFunction = useCallback((eventName) => {
    return (data) => {
      if (!socket || !socket.connected || !roomId) {
        console.warn(`Cannot emit ${eventName}: socket not connected`)
        return false
      }

      try {
        const payload = {
          roomId,
          ...data,
          timestamp: Date.now(),
          sessionId: sessionStorage.getItem('sessionId') || Date.now().toString()
        }
        
        socket.emit(eventName, payload, (ack) => {
          if (ack && ack.error) {
            console.error(`Error emitting ${eventName}:`, ack.error)
          }
        })
        
        setLastActivity(Date.now())
        return true
      } catch (error) {
        console.error(`Error emitting ${eventName}:`, error)
        return false
      }
    }
  }, [roomId])

  // Emit functions
  const emitCodeChange = useCallback((code) => {
    return createEmitFunction('code-change')({ code })
  }, [createEmitFunction])

  const emitOutputChange = useCallback((output) => {
    return createEmitFunction('output-change')({ output })
  }, [createEmitFunction])

  const emitLanguageChange = useCallback((language) => {
    return createEmitFunction('language-change')({ language })
  }, [createEmitFunction])

  const emitInputChange = useCallback((input) => {
    return createEmitFunction('input-change')({ input })
  }, [createEmitFunction])

  const emitSubmissionStatus = useCallback((status, studentId) => {
    return createEmitFunction('submission-status')({ status, studentId })
  }, [createEmitFunction])

  const emitHtmlChange = useCallback((code) => {
    return createEmitFunction('html-change')({ code })
  }, [createEmitFunction])

  const emitCssChange = useCallback((code) => {
    return createEmitFunction('css-change')({ code })
  }, [createEmitFunction])

  const emitJsChange = useCallback((code) => {
    return createEmitFunction('js-change')({ code })
  }, [createEmitFunction])

  // Manual reconnection function
  const reconnect = useCallback(() => {
    if (socket) {
      socket.disconnect()
      setTimeout(() => {
        socket.connect()
      }, 1000)
    }
  }, [])

  return {
    socket,
    isConnected,
    activeStudents,
    connectionAttempts,
    lastActivity: new Date(lastActivity).toLocaleTimeString(),
    reconnect,
    emitCodeChange,
    emitOutputChange,
    emitLanguageChange,
    emitInputChange,
    emitSubmissionStatus,
    emitHtmlChange,
    emitCssChange,
    emitJsChange,
  }
}

export default useSocket