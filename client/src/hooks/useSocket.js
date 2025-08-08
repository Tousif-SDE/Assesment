import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import { updateEditorState, setCode, setOutput, setLanguage, setInput } from '../redux/slices/editorSlice'

// Create a single socket instance for the entire app
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
})

const useSocket = (roomId) => {
  const dispatch = useDispatch()
  const [isConnected, setIsConnected] = useState(false)
  const [activeStudents, setActiveStudents] = useState([])
  const { isEditable } = useSelector((state) => state.editor)

  useEffect(() => {
    // Connect to socket server if not already connected
    if (!socket.connected) {
      socket.connect()
    }

    // Set up event listeners
    const onConnect = () => {
      setIsConnected(true)
      console.log('Socket connected:', socket.id)
      
      // Join room when connected
      if (roomId) {
        socket.emit('join-room', { roomId })
      }
    }

    const onDisconnect = () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    }

    const onCodeUpdate = ({ code }) => {
      // Only update code from teacher when not in editable mode (student)
      if (!isEditable) {
        dispatch(setCode(code))
      }
    }

    const onOutputUpdate = ({ output }) => {
      dispatch(setOutput(output))
    }
    
    const onLanguageUpdate = ({ language }) => {
      dispatch(setLanguage(language))
    }

    const onInputUpdate = ({ input }) => {
      dispatch(setInput(input))
    }

    const onStudentUpdate = ({ students }) => {
      setActiveStudents(students)
    }

    // Register event listeners
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('code-update', onCodeUpdate)
    socket.on('html-update', onCodeUpdate) // Reuse onCodeUpdate for HTML
    socket.on('css-update', onCodeUpdate) // Reuse onCodeUpdate for CSS
    socket.on('js-update', onCodeUpdate) // Reuse onCodeUpdate for JavaScript
    socket.on('output-update', onOutputUpdate)
    socket.on('language-update', onLanguageUpdate)
    socket.on('input-update', onInputUpdate)
    socket.on('student-update', onStudentUpdate)

    return () => {
      // Clean up event listeners
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('code-update', onCodeUpdate)
      socket.off('html-update', onCodeUpdate)
      socket.off('css-update', onCodeUpdate)
      socket.off('js-update', onCodeUpdate)
      socket.off('output-update', onOutputUpdate)
      socket.off('language-update', onLanguageUpdate)
      socket.off('input-update', onInputUpdate)
      socket.off('student-update', onStudentUpdate)
      
      // Leave room when component unmounts
      if (roomId) {
        socket.emit('leave-room', { roomId })
      }
    }
  }, [roomId, dispatch, isEditable])

  // Function to emit code changes
  const emitCodeChange = useCallback((code) => {
    if (isConnected && roomId) {
      socket.emit('code-change', { roomId, code })
    }
  }, [isConnected, roomId])

  // Function to emit output changes
  const emitOutputChange = useCallback((output) => {
    if (isConnected && roomId) {
      socket.emit('output-change', { roomId, output })
    }
  }, [isConnected, roomId])

  // Function to emit language changes
  const emitLanguageChange = useCallback((language) => {
    if (isConnected && roomId) {
      socket.emit('language-change', { roomId, language })
    }
  }, [isConnected, roomId])

  // Function to emit input changes
  const emitInputChange = useCallback((input) => {
    if (isConnected && roomId) {
      socket.emit('input-change', { roomId, input })
    }
  }, [isConnected, roomId])

  // Function to emit submission status
  const emitSubmissionStatus = useCallback((status, studentId) => {
    if (isConnected && roomId) {
      socket.emit('submission-status', { roomId, status, studentId })
    }
  }, [isConnected, roomId])

  // Function to emit HTML code changes
  const emitHtmlChange = useCallback((code) => {
    if (isConnected && roomId) {
      socket.emit('html-change', { roomId, code })
    }
  }, [isConnected, roomId])

  // Function to emit CSS code changes
  const emitCssChange = useCallback((code) => {
    if (isConnected && roomId) {
      socket.emit('css-change', { roomId, code })
    }
  }, [isConnected, roomId])

  // Function to emit JavaScript code changes
  const emitJsChange = useCallback((code) => {
    if (isConnected && roomId) {
      socket.emit('js-change', { roomId, code })
    }
  }, [isConnected, roomId])

  return {
    socket,
    isConnected,
    activeStudents,
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