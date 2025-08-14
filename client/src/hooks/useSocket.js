// client/src/hooks/useSocket.js - Enhanced for Real-time Broadcasting
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import io from 'socket.io-client';

const useSocket = (roomId) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeStudents, setActiveStudents] = useState([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const dispatch = useDispatch();
  
  // Refs to prevent stale closures
  const roomIdRef = useRef(roomId);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // Initialize socket connection
  useEffect(() => {
    if (!roomId) return;

    const initializeSocket = () => {
      console.log(`Initializing socket connection for room: ${roomId}`);
      
      const newSocket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        setConnectionAttempts(0);
        
        // Join room immediately on connection
        const sessionId = sessionStorage.getItem('sessionId');
        if (sessionId && roomIdRef.current) {
          newSocket.emit('join-room', {
            roomId: roomIdRef.current,
            sessionId,
            timestamp: Date.now(),
            userAgent: navigator.userAgent
          });
        }

        // Start heartbeat to maintain connection
        startHeartbeat(newSocket);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        stopHeartbeat();
        
        // Auto-reconnect for certain disconnect reasons
        if (reason === 'io server disconnect' || reason === 'transport close') {
          setTimeout(() => attemptReconnect(), 2000);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
        setConnectionAttempts(prev => prev + 1);
      });

      newSocket.on('reconnect', () => {
        console.log('Socket reconnected');
        setIsConnected(true);
        setConnectionAttempts(0);
      });

      // Room event handlers
      newSocket.on('room-update', (data) => {
        setActiveStudents(data.students || []);
      });

      newSocket.on('room-error', (data) => {
        console.error('Room error:', data.error);
      });

      return newSocket;
    };

    const newSocket = initializeSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      
      if (newSocket) {
        newSocket.disconnect();
      }
      
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [roomId]);

  // Heartbeat to maintain connection
  const startHeartbeat = (socket) => {
    stopHeartbeat(); // Clear any existing heartbeat
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('ping', { timestamp: Date.now() });
      }
    }, 25000); // Send ping every 25 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Reconnection logic
  const attemptReconnect = useCallback(() => {
    if (connectionAttempts >= 5) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(`Attempting to reconnect... (${connectionAttempts + 1}/5)`);
      
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // Reinitialize socket
      const newSocket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', {
        transports: ['websocket', 'polling'],
        forceNew: true
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    }, Math.min(1000 * Math.pow(2, connectionAttempts), 10000)); // Exponential backoff
  }, [connectionAttempts]);

  const reconnect = useCallback(() => {
    console.log('Manual reconnect triggered');
    setConnectionAttempts(0);
    attemptReconnect();
  }, [attemptReconnect]);

  // REAL-TIME BROADCASTING FUNCTIONS - Enhanced for instant updates
  const emitCodeChange = useCallback((code) => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      const sessionId = sessionStorage.getItem('sessionId');
      socketRef.current.emit('code-change', {
        roomId: roomIdRef.current,
        code,
        sessionId,
        timestamp: Date.now()
      });
    }
  }, [isConnected]);

  const emitOutputChange = useCallback((output) => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      const sessionId = sessionStorage.getItem('sessionId');
      socketRef.current.emit('output-change', {
        roomId: roomIdRef.current,
        output,
        sessionId,
        timestamp: Date.now()
      });
    }
  }, [isConnected]);

  const emitLanguageChange = useCallback((language) => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      const sessionId = sessionStorage.getItem('sessionId');
      socketRef.current.emit('language-change', {
        roomId: roomIdRef.current,
        language,
        sessionId,
        timestamp: Date.now()
      });
    }
  }, [isConnected]);

  const emitInputChange = useCallback((input) => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      const sessionId = sessionStorage.getItem('sessionId');
      socketRef.current.emit('input-change', {
        roomId: roomIdRef.current,
        input,
        sessionId,
        timestamp: Date.now()
      });
    }
  }, [isConnected]);

  // Dashboard data functions
  const emitDashboardDataRequest = useCallback(() => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      socketRef.current.emit('request-dashboard-data', {
        roomId: roomIdRef.current
      });
    }
  }, [isConnected]);

  const emitStudentProgressUpdate = useCallback((progressData) => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      const sessionId = sessionStorage.getItem('sessionId');
      socketRef.current.emit('student-progress-update', {
        roomId: roomIdRef.current,
        sessionId,
        ...progressData,
        timestamp: Date.now()
      });
    }
  }, [isConnected]);

  // Request sync when connection is established
  const requestSync = useCallback(() => {
    if (socketRef.current && isConnected && roomIdRef.current) {
      socketRef.current.emit('request-sync', {
        roomId: roomIdRef.current
      });
    }
  }, [isConnected]);

  // Auto-request sync when connected
  useEffect(() => {
    if (isConnected && roomId) {
      // Small delay to ensure room join is processed
      setTimeout(() => {
        requestSync();
      }, 500);
    }
  }, [isConnected, roomId, requestSync]);

  return {
    socket: socketRef.current,
    isConnected,
    activeStudents,
    connectionAttempts,
    reconnect,
    requestSync,
    
    // Real-time broadcasting functions
    emitCodeChange,
    emitOutputChange,
    emitLanguageChange,
    emitInputChange,
    
    // Dashboard functions
    emitDashboardDataRequest,
    emitStudentProgressUpdate
  };
};

export default useSocket;