// server/socket.js - Enhanced with Real-time Broadcasting & Dashboard Updates
import { Server } from 'socket.io';
import redis from './redis/redisClient.js';
import { executeCode } from './services/judge0Api.js';

const isRedisConnected = () => {
  return redis.isReady && redis.isOpen;
};

class SocketManager {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "http://localhost:3000",
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
    this.persistTimeouts = {}; // Initialize persistTimeouts here
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Room management
      socket.on('join-room', ({ roomId, timestamp, userAgent, sessionId }) => {
        this.handleJoinRoom(socket, roomId, sessionId, { timestamp, userAgent });
      });

      // FIXED: Real-time code broadcasting - listen for all event names from frontend
      socket.on('code-change', ({ roomId, code, timestamp, sessionId }) => {
        this.handleCodeChange(socket, roomId, code, timestamp, sessionId);
      });

      socket.on('code-update', ({ code, timestamp, sessionId }) => {
        this.handleCodeChange(socket, socket.roomId, code, timestamp, sessionId);
      });

      socket.on('output-change', ({ roomId, output, timestamp, sessionId }) => {
        this.handleOutputChange(socket, roomId, output, timestamp, sessionId);
      });

      socket.on('output-update', ({ output, timestamp, sessionId }) => {
        this.handleOutputChange(socket, socket.roomId, output, timestamp, sessionId);
      });

      socket.on('language-change', ({ roomId, language, timestamp, sessionId }) => {
        this.handleLanguageChange(socket, roomId, language, timestamp, sessionId);
      });

      socket.on('language-update', ({ language, timestamp, sessionId }) => {
        this.handleLanguageChange(socket, socket.roomId, language, timestamp, sessionId);
      });

      socket.on('input-change', ({ roomId, input, timestamp, sessionId }) => {
        this.handleInputChange(socket, roomId, input, timestamp, sessionId);
      });

      socket.on('input-update', ({ input, timestamp, sessionId }) => {
        this.handleInputChange(socket, socket.roomId, input, timestamp, sessionId);
      });

      // Enhanced test case handlers
      socket.on('create-test-case', ({ roomId, testCase, timestamp }) => {
        this.handleCreateTestCase(socket, roomId, testCase, timestamp);
      });

      socket.on('run-against-test-cases', ({ roomId, code, language, sessionId }) => {
        this.handleRunAgainstTestCases(socket, roomId, code, language, sessionId);
      });

      socket.on('submit-solution', ({ roomId, code, language, sessionId, timeTaken }) => {
        this.handleSubmitSolution(socket, roomId, code, language, sessionId, timeTaken);
      });

      socket.on('request-sync', ({ roomId }) => {
        this.handleSyncRequest(socket, roomId);
      });

      // Dashboard data requests
      socket.on('request-dashboard-data', ({ roomId }) => {
        this.handleDashboardDataRequest(socket, roomId);
      });

      socket.on('disconnect', (reason) => {
        this.handleDisconnect(socket, reason);
      });
    });
  }

  async handleJoinRoom(socket, roomId, sessionId, metadata = {}) {
    if (!roomId) {
      socket.emit('room-error', { error: 'Room ID is required' });
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.sessionId = sessionId;
    socket.joinedAt = new Date();

    const isTeacher = sessionId && sessionId.startsWith('teacher-');

    // Store user session info
    this.userSessions.set(socket.id, {
      roomId,
      sessionId,
      isTeacher,
      joinedAt: socket.joinedAt,
      metadata
    });

    // Initialize room if not exists
    let roomData = this.rooms.get(roomId);
    if (!roomData) {
      // Try to load from Redis first
      if (isRedisConnected()) {
        try {
          const redisRoomData = await redis.get(`room:${roomId}`);
          if (redisRoomData) {
            roomData = JSON.parse(redisRoomData);
          }
        } catch (err) {
          console.error('Failed to load room from Redis:', err);
        }
      }

      if (!roomData) {
        roomData = {
          id: roomId,
          students: [],
          teachers: [],
          testCases: [],
          submissions: [],
          createdAt: new Date(),
          lastActivity: new Date(),
          currentState: { code: '', input: '', output: '', language: 'javascript' },
          stats: {
            totalSubmissions: 0,
            solvedTestCases: 0,
            activeStudentsCount: 0
          }
        };
      }
      
      this.rooms.set(roomId, roomData);
    }

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

    // Persist to Redis
    await this.persistRoomData(roomId, roomData);

    console.log(`${isTeacher ? 'Teacher' : 'Student'} joined room ${roomId}: ${sessionId}`);

    // Emit updated room info and dashboard data
    this.broadcastRoomUpdate(roomId);
    this.broadcastDashboardUpdate(roomId);

    // Send current data to new joiner
    if (roomData.testCases.length > 0) {
      socket.emit('test-cases-sync', { testCases: roomData.testCases });
    }

    // Send current code state to students
    if (!isTeacher && roomData.currentState) {
      socket.emit('sync-state', roomData.currentState);
    }

    // Send dashboard data to teachers
    if (isTeacher) {
      this.sendDashboardData(socket, roomId);
    }
  }

  async handleCreateTestCase(socket, roomId, testCase, timestamp) {
    if (!roomId || !testCase) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    // Add unique ID to test case
    const newTestCase = {
      ...testCase,
      id: `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };

    room.testCases.push(newTestCase);
    room.lastActivity = new Date();

    // Persist to Redis
    await this.persistRoomData(roomId, room);

    // Broadcast to all clients in room
    this.io.to(roomId).emit('test-case-created', { 
      testCase: newTestCase, 
      totalTestCases: room.testCases.length,
      timestamp 
    });

    // Send notification to students
    this.io.to(roomId).emit('notification', {
      type: 'info',
      message: `New test case "${newTestCase.title}" published`,
      timestamp
    });

    // Update dashboard
    this.broadcastDashboardUpdate(roomId);

    console.log(`Test case created in room ${roomId}:`, newTestCase.title);
  }

  async handleRunAgainstTestCases(socket, roomId, code, language, sessionId) {
    const room = this.rooms.get(roomId);
    if (!room || room.testCases.length === 0) {
      socket.emit('test-results', { error: 'No test cases available' });
      return;
    }

    const results = [];
    
    // Actually run code against each test case using Judge0 API
    for (let i = 0; i < room.testCases.length; i++) {
      const testCase = room.testCases[i];
      
      try {
        // Execute code with the test case input
        const executionResult = await executeCode(language, code, testCase.input);
        
        // Get the actual output from execution
        const actualOutput = executionResult.stdout?.trim() || '';
        const expectedOutput = testCase.expectedOutput?.trim() || '';
        const passed = actualOutput === expectedOutput;
        
        results.push({
          testCaseId: testCase.id,
          testCaseIndex: i + 1,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: actualOutput,
          passed,
          runtime: executionResult.time ? `${executionResult.time}s` : 'N/A',
          error: executionResult.stderr || executionResult.compile_output || ''
        });
      } catch (error) {
        console.error(`Error executing code for test case ${testCase.id}:`, error);
        results.push({
          testCaseId: testCase.id,
          testCaseIndex: i + 1,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: 'Execution error',
          passed: false,
          runtime: 'N/A',
          error: error.message || 'Unknown error during code execution'
        });
      }
    }

    const passedTests = results.filter(r => r.passed).length;

    // Record attempt with detailed results
    const attempt = {
      id: `attempt_${Date.now()}`,
      studentId: sessionId,
      roomId,
      testResults: results,
      passedTests,
      totalTests: room.testCases.length,
      timestamp: new Date()
    };

    if (!room.attempts) room.attempts = [];
    room.attempts.push(attempt);

    // Update stats
    room.stats.totalSubmissions = (room.stats.totalSubmissions || 0) + 1;

    // Persist to Redis for data retention after re-login
    await this.persistRoomData(roomId, room);

    // Send detailed results to student
    socket.emit('test-results', { 
      results, 
      totalTests: room.testCases.length,
      passedTests
    });

    // Update dashboard for teachers
    this.broadcastDashboardUpdate(roomId);
  }

  async handleSubmitSolution(socket, roomId, code, language, sessionId, timeTaken) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Simulate submission evaluation
    const submission = {
      id: `sub_${Date.now()}`,
      studentId: sessionId,
      roomId,
      code,
      language,
      timeTaken,
      status: Math.random() > 0.4 ? 'Accepted' : 'Wrong Answer',
      passedTests: Math.floor(Math.random() * room.testCases.length),
      totalTests: room.testCases.length,
      createdAt: new Date()
    };

    // Store submission
    if (!room.submissions) room.submissions = [];
    room.submissions.push(submission);

    // Update stats
    room.stats.totalSubmissions = (room.stats.totalSubmissions || 0) + 1;
    if (submission.status === 'Accepted') {
      room.stats.solvedTestCases = (room.stats.solvedTestCases || 0) + 1;
    }

    await this.persistRoomData(roomId, room);

    // Send result to student
    socket.emit('submission-result', submission);

    // Notify teacher with student info
    const sessionInfo = this.userSessions.get(socket.id);
    const studentName = sessionInfo?.metadata?.userAgent || 'Student';
    
    socket.to(roomId).emit('student-submission', {
      submission,
      studentName,
      timestamp: Date.now()
    });

    socket.to(roomId).emit('notification', {
      type: submission.status === 'Accepted' ? 'success' : 'warning',
      message: `${studentName} submitted solution - ${submission.status}`,
      timestamp: Date.now()
    });

    // Update dashboard in real-time
    this.broadcastDashboardUpdate(roomId);

    console.log(`Submission received from ${sessionId}: ${submission.status}`);
  }

  async handleSyncRequest(socket, roomId) {
    console.log(`🔄 Sync request received from ${socket.id} for room ${roomId}`);
    
    if (!roomId) {
      socket.emit('sync-error', { error: 'Room ID is required' });
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit('sync-error', { error: 'Room not found' });
      return;
    }

    const sessionInfo = this.userSessions.get(socket.id);
    if (!sessionInfo) {
      socket.emit('sync-error', { error: 'Session not found' });
      return;
    }

    // Send current room state to the requesting client
    const syncData = {
      currentState: room.currentState || {
        code: '',
        input: '',
        output: '',
        language: 'javascript'
      },
      testCases: room.testCases || [],
      timestamp: new Date().toISOString()
    };

    // Send sync data to the requesting socket
    socket.emit('sync-state', syncData.currentState);
    
    if (syncData.testCases.length > 0) {
      socket.emit('test-cases-sync', { testCases: syncData.testCases });
    }

    // If it's a teacher, also send dashboard data
    if (sessionInfo.isTeacher) {
      await this.sendDashboardData(socket, roomId);
    }

    console.log(`✅ Sync data sent to ${socket.id} for room ${roomId}`);
  }

  // FIXED: REAL-TIME CODE BROADCASTING - Enhanced for instant sync
  handleCodeChange(socket, roomId, code, timestamp, sessionId) {
    console.log(`🔄 Code change received from ${socket.id} in room ${roomId}`);
    console.log(`📝 Code length: ${code?.length}, SessionId: ${sessionId}`);
    
    if (!roomId) {
      console.log('❌ No roomId provided');
      return;
    }

    const sessionInfo = this.userSessions.get(socket.id);
    console.log(`👤 Session info:`, { 
      isTeacher: sessionInfo?.isTeacher, 
      sessionId: sessionInfo?.sessionId 
    });
    
    // FIXED: Allow both teachers AND students to broadcast code changes
    // Teachers broadcast to students, students can also broadcast to teachers for collaboration
    if (sessionInfo) {
      const room = this.rooms.get(roomId);
      if (room) {
        // Update room state only if it's from teacher
        if (sessionInfo.isTeacher) {
          room.currentState.code = code;
          room.lastActivity = new Date();
          this.persistCurrentState(roomId, room.currentState);
          console.log(`✅ Updated room state with teacher's code`);
        }
      }
      
      // FIXED: Broadcast to ALL other clients in room (not just students)
      console.log(`📡 Broadcasting code to room ${roomId}`);
      socket.to(roomId).emit('code-update', { code, timestamp, sessionId });
      
      // Also emit direct sync for immediate response
      socket.to(roomId).emit('sync-state', { code, timestamp });
      
      // Throttled Redis persistence to avoid excessive writes
      this.throttledPersist(roomId);
    } else {
      console.log('❌ No session info found for socket');
    }
  }

  handleOutputChange(socket, roomId, output, timestamp, sessionId) {
    console.log(`🔄 Output change received from ${socket.id} in room ${roomId}`);
    
    if (!roomId) return;
    
    const sessionInfo = this.userSessions.get(socket.id);
    
    if (sessionInfo && sessionInfo.isTeacher) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.currentState.output = output;
        room.lastActivity = new Date();
        this.persistCurrentState(roomId, room.currentState);
      }
      
      console.log(`📡 Broadcasting output to room ${roomId}`);
      socket.to(roomId).emit('output-update', { output, timestamp, sessionId });
      socket.to(roomId).emit('sync-state', { output, timestamp });
      this.throttledPersist(roomId);
    }
  }

  handleLanguageChange(socket, roomId, language, timestamp, sessionId) {
    console.log(`🔄 Language change received from ${socket.id} in room ${roomId}: ${language}`);
    
    if (!roomId) return;
    
    const sessionInfo = this.userSessions.get(socket.id);
    
    // FIXED: Allow both teachers and students to change language
    if (sessionInfo) {
      const room = this.rooms.get(roomId);
      if (room) {
        // Update room state if it's from teacher
        if (sessionInfo.isTeacher) {
          room.currentState.language = language;
          room.lastActivity = new Date();
          this.persistCurrentState(roomId, room.currentState);
        }
      }
      
      console.log(`📡 Broadcasting language change to room ${roomId}`);
      socket.to(roomId).emit('language-update', { language, timestamp, sessionId });
      socket.to(roomId).emit('sync-state', { language, timestamp });
      this.throttledPersist(roomId);
    }
  }

  // In socket.js - Fix the handleInputChange function
  handleInputChange(socket, roomId, input, timestamp, sessionId) {
    console.log(`🔄 Input change received from ${socket.id} in room ${roomId}`);
    
    if (!roomId) return;
    
    const sessionInfo = this.userSessions.get(socket.id);
    
    // FIXED: Allow both teachers AND students to broadcast input changes
    if (sessionInfo) {
      const room = this.rooms.get(roomId);
      if (room) {
        // Update room state for both teacher and student inputs
        room.currentState.input = input;
        room.lastActivity = new Date();
        this.persistCurrentState(roomId, room.currentState);
        console.log(`✅ Updated room state with input from ${sessionInfo.isTeacher ? 'teacher' : 'student'}`);
      }
      
      console.log(`📡 Broadcasting input to all clients in room ${roomId}`);
      // FIXED: Broadcast to ALL clients in room
      socket.to(roomId).emit('input-update', { input, timestamp, sessionId });
      socket.to(roomId).emit('sync-state', { input, timestamp });
      this.throttledPersist(roomId);
    }
  }

  // REAL-TIME DASHBOARD DATA
  async handleDashboardDataRequest(socket, roomId) {
    await this.sendDashboardData(socket, roomId);
  }

  async sendDashboardData(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Calculate real-time stats
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    const activeStudents = room.students.filter(s => 
      new Date(s.lastSeen) > thirtyMinutesAgo
    );

    const recentSubmissions = (room.submissions || []).filter(s => 
      new Date(s.createdAt) > thirtyMinutesAgo
    );

    const solvedTestCases = (room.submissions || []).filter(s => 
      s.status === 'Accepted'
    );

    const dashboardData = {
      roomId,
      stats: {
        activeStudentsCount: activeStudents.length,
        testCasesAttempted: recentSubmissions.length,
        testCasesSolved: solvedTestCases.length,
        totalStudents: room.students.length,
        totalTestCases: room.testCases.length
      },
      recentSubmissions: recentSubmissions.slice(-10), // Last 10 submissions
      solvedTestCases: solvedTestCases.map(s => ({
        studentId: s.studentId,
        testCaseTitle: room.testCases.find(tc => tc.id === s.testCaseId)?.title || 'Unknown',
        solvedAt: s.createdAt,
        timeTaken: s.timeTaken
      })),
      students: room.students.map(s => ({
        sessionId: s.sessionId,
        joinedAt: s.joinedAt,
        lastSeen: s.lastSeen,
        isActive: new Date(s.lastSeen) > thirtyMinutesAgo
      }))
    };

    socket.emit('dashboard-data', dashboardData);
  }

  broadcastDashboardUpdate(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Send updated dashboard data to all teachers in the room
    room.teachers.forEach(teacher => {
      const teacherSocket = this.io.sockets.sockets.get(teacher.socketId);
      if (teacherSocket) {
        this.sendDashboardData(teacherSocket, roomId);
      }
    });
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
      
      roomData.lastActivity = new Date();
      this.persistRoomData(sessionInfo.roomId, roomData);
      
      this.broadcastRoomUpdate(sessionInfo.roomId);
      this.broadcastDashboardUpdate(sessionInfo.roomId);
    }
    
    this.userSessions.delete(socket.id);
  }

  broadcastRoomUpdate(roomId) {
    if (this.rooms.has(roomId)) {
      const roomData = this.rooms.get(roomId);
      this.io.to(roomId).emit('room-update', {
        studentsCount: roomData.students.length,
        teachersCount: roomData.teachers.length,
        students: roomData.students,
        teachers: roomData.teachers
      });
    }
  }

  // Redis persistence helpers
  async persistRoomData(roomId, roomData) {
    if (isRedisConnected()) {
      try {
        // Increase expiration to 7 days for better data retention
        await redis.set(`room:${roomId}`, JSON.stringify(roomData), 'EX', 604800); // 7 days
        
        // Also persist test cases separately for faster access
        if (roomData.testCases && roomData.testCases.length > 0) {
          await redis.set(`room:${roomId}:testcases`, JSON.stringify(roomData.testCases), 'EX', 604800);
        }
        
        // Persist attempts separately
        if (roomData.attempts && roomData.attempts.length > 0) {
          await redis.set(`room:${roomId}:attempts`, JSON.stringify(roomData.attempts), 'EX', 604800);
        }
      } catch (err) {
        console.error('Failed to persist room data:', err);
      }
    }
  }

  async persistCurrentState(roomId, currentState) {
    if (isRedisConnected()) {
      try {
        await redis.set(`room:${roomId}:state`, JSON.stringify(currentState), 'EX', 3600); // 1 hour
      } catch (err) {
        console.error('Failed to persist current state:', err);
      }
    }
  }

  // Throttled persistence to avoid Redis overload during rapid typing
  throttledPersist(roomId) {
    if (this.persistTimeouts[roomId]) {
      clearTimeout(this.persistTimeouts[roomId]);
    }

    this.persistTimeouts[roomId] = setTimeout(async () => {
      const room = this.rooms.get(roomId);
      if (room) {
        await this.persistRoomData(roomId, room);
      }
    }, 1000); // Persist after 1 second of inactivity
  }
}

export function initializeSocket(server, app) {
  const socketManager = new SocketManager(server);
  
  if (app) {
    app.set('socketManager', socketManager);
  }
  
  return socketManager;
}

export default initializeSocket;