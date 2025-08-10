// server/socket.js
import { Server } from 'socket.io';

class SocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",  // Vite dev server default port
          "http://localhost:3000",  // Alternative React dev port
          "http://127.0.0.1:5173",
          process.env.CLIENT_URL
        ].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.rooms = new Map();
    this.userSessions = new Map();

    this.setupSocketHandlers();
  }

  // ... rest of your code remains the same
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on('join-room', ({ roomId, timestamp, userAgent, sessionId }) => {
        this.handleJoinRoom(socket, roomId, sessionId, { timestamp, userAgent });
      });

      socket.on('leave-room', ({ roomId, timestamp }) => {
        this.handleLeaveRoom(socket, roomId, timestamp);
      });

      socket.on('code-change', ({ roomId, code, timestamp, sessionId }) => {
        this.handleCodeChange(socket, roomId, code, timestamp, sessionId);
      });

      socket.on('output-change', ({ roomId, output, timestamp, sessionId }) => {
        this.handleOutputChange(socket, roomId, output, timestamp, sessionId);
      });

      socket.on('language-change', ({ roomId, language, timestamp, sessionId }) => {
        this.handleLanguageChange(socket, roomId, language, timestamp, sessionId);
      });

      socket.on('input-change', ({ roomId, input, timestamp, sessionId }) => {
        this.handleInputChange(socket, roomId, input, timestamp, sessionId);
      });

      socket.on('test-case-created', ({ roomId, testCase, timestamp }) => {
        this.handleTestCaseCreated(socket, roomId, testCase, timestamp);
      });

      socket.on('submission-status', ({ roomId, status, testCaseId, studentId, timeTaken }) => {
        this.handleSubmissionStatus(socket, roomId, status, testCaseId, studentId, timeTaken);
      });

      socket.on('heartbeat', ({ roomId, timestamp }) => {
        this.handleHeartbeat(socket, roomId, timestamp);
      });

      socket.on('request-sync', ({ roomId }) => {
        this.handleSyncRequest(socket, roomId);
      });

      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });

      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  handleJoinRoom(socket, roomId, sessionId, metadata = {}) {
    if (!roomId) {
      socket.emit('room-error', { error: 'Room ID is required', message: 'Please provide a valid room ID' });
      return;
    }
    socket.join(roomId);
    socket.roomId = roomId;
    socket.sessionId = sessionId;
    socket.joinedAt = new Date();

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        students: [],
        teachers: [],
        testCases: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        currentState: {
          code: '',
          input: '',
          output: '',
          language: 'javascript'
        }
      });
    }

    const roomData = this.rooms.get(roomId);
    const isTeacher = sessionId && sessionId.startsWith('teacher-');

    const userData = {
      socketId: socket.id,
      sessionId,
      joinedAt: socket.joinedAt,
      lastSeen: new Date(),
      metadata
    };

    if (isTeacher) {
      roomData.teachers = roomData.teachers.filter(t => t.sessionId !== sessionId);
      roomData.teachers.push(userData);
    } else {
      roomData.students = roomData.students.filter(s => s.sessionId !== sessionId);
      roomData.students.push(userData);
    }

    roomData.lastActivity = new Date();
    this.userSessions.set(socket.id, { roomId, sessionId, isTeacher, joinedAt: socket.joinedAt });

    console.log(`${isTeacher ? 'Teacher' : 'Student'} joined room ${roomId}: ${sessionId}`);

    socket.emit('room-joined', {
      success: true,
      message: `Successfully joined room ${roomId}`,
      roomInfo: {
        students: roomData.students.length,
        teachers: roomData.teachers.length,
        testCases: roomData.testCases.length
      }
    });

    if (!isTeacher && roomData.currentState) {
      socket.emit('sync-state', roomData.currentState);
    }

    this.broadcastStudentUpdate(roomId);
  }

  handleLeaveRoom(socket, roomId, timestamp) {
    if (socket.roomId && this.rooms.has(socket.roomId)) {
      const roomData = this.rooms.get(socket.roomId);
      const sessionInfo = this.userSessions.get(socket.id);

      if (sessionInfo) {
        if (sessionInfo.isTeacher) {
          roomData.teachers = roomData.teachers.filter(t => t.socketId !== socket.id);
        } else {
          roomData.students = roomData.students.filter(s => s.socketId !== socket.id);
        }
        roomData.lastActivity = new Date();
        console.log(`${sessionInfo.isTeacher ? 'Teacher' : 'Student'} left room ${socket.roomId}`);
        this.broadcastStudentUpdate(socket.roomId);
      }

      if (roomData.students.length === 0 && roomData.teachers.length === 0) {
        this.rooms.delete(socket.roomId);
      }
    }
    socket.leave(roomId);
    this.userSessions.delete(socket.id);
    socket.emit('room-left', { success: true, message: `You have left room ${roomId}`, timestamp });
  }

  handleCodeChange(socket, roomId, code, timestamp, sessionId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).currentState.code = code;
    }
    
    const sessionInfo = this.userSessions.get(socket.id);
    if (sessionInfo && sessionInfo.isTeacher) {
      socket.to(roomId).emit('code-update', { code, timestamp, sessionId });
    }
  }

  handleOutputChange(socket, roomId, output, timestamp, sessionId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).currentState.output = output;
    }
    
    const sessionInfo = this.userSessions.get(socket.id);
    if (sessionInfo && sessionInfo.isTeacher) {
      socket.to(roomId).emit('output-update', { output, timestamp, sessionId });
    }
  }

  handleLanguageChange(socket, roomId, language, timestamp, sessionId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).currentState.language = language;
    }
    
    const sessionInfo = this.userSessions.get(socket.id);
    if (sessionInfo && sessionInfo.isTeacher) {
      socket.to(roomId).emit('language-update', { language, timestamp, sessionId });
    }
  }

  handleInputChange(socket, roomId, input, timestamp, sessionId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).currentState.input = input;
    }
    
    const sessionInfo = this.userSessions.get(socket.id);
    if (sessionInfo && sessionInfo.isTeacher) {
      socket.to(roomId).emit('input-update', { input, timestamp, sessionId });
    }
  }

  handleTestCaseCreated(socket, roomId, testCase, timestamp) {
    socket.to(roomId).emit('test-case-created', { testCase, timestamp });
  }

  handleSubmissionStatus(socket, roomId, status, testCaseId, studentId, timeTaken) {
    socket.to(roomId).emit('submission-update', { status, testCaseId, studentId, timeTaken });
  }

  handleHeartbeat(socket, roomId, timestamp) {
    const sessionInfo = this.userSessions.get(socket.id);
    if (sessionInfo) sessionInfo.lastSeen = new Date();
    socket.emit('heartbeat-ack', { timestamp });
  }

  handleSyncRequest(socket, roomId) {
    if (this.rooms.has(roomId)) {
      const roomData = this.rooms.get(roomId);
      socket.emit('sync-state', roomData.currentState);
    }
  }

  handleDisconnect(socket, reason) {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    const sessionInfo = this.userSessions.get(socket.id);
    if (sessionInfo && this.rooms.has(sessionInfo.roomId)) {
      const roomData = this.rooms.get(sessionInfo.roomId);
      if (sessionInfo.isTeacher) {
        roomData.teachers = roomData.teachers.filter(t => t.socketId !== socket.id);
      } else {
        roomData.students = roomData.students.filter(s => s.socketId !== socket.id);
      }
      this.broadcastStudentUpdate(sessionInfo.roomId);
      if (roomData.students.length === 0 && roomData.teachers.length === 0) {
        this.rooms.delete(sessionInfo.roomId);
      }
    }
    this.userSessions.delete(socket.id);
  }

  broadcastStudentUpdate(roomId) {
    if (this.rooms.has(roomId)) {
      const roomData = this.rooms.get(roomId);
      this.io.to(roomId).emit('student-update', {
        students: roomData.students,
        teachers: roomData.teachers
      });
    }
  }
}

export function initializeSocket(server) {
  return new SocketManager(server);
}