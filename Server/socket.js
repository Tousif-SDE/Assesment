import { Server } from 'socket.io';

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Track active students per room
  const activeStudents = {};
  const studentStatus = {};

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    let currentRoom = null;

    socket.on('join-room', ({ roomId }) => {
      socket.join(roomId);
      currentRoom = roomId;
      console.log(`👥 ${socket.id} joined room ${roomId}`);
      
      // Initialize room tracking if needed
      if (!activeStudents[roomId]) {
        activeStudents[roomId] = new Set();
      }
      if (!studentStatus[roomId]) {
        studentStatus[roomId] = {};
      }
      
      // Add student to active list
      activeStudents[roomId].add(socket.id);
      
      // Emit updated student list to room
      io.to(roomId).emit('student-update', { 
        students: Array.from(activeStudents[roomId])
      });
    });

    socket.on('leave-room', ({ roomId }) => {
      socket.leave(roomId);
      console.log(`👋 ${socket.id} left room ${roomId}`);
      
      // Remove student from active list
      if (activeStudents[roomId]) {
        activeStudents[roomId].delete(socket.id);
        
        // Emit updated student list to room
        io.to(roomId).emit('student-update', { 
          students: Array.from(activeStudents[roomId])
        });
      }
    });

    // Code changes from teacher to students
    socket.on('code-change', ({ roomId, code }) => {
      socket.to(roomId).emit('code-update', { code });
    });

    // Output changes from teacher to students
    socket.on('output-change', ({ roomId, output }) => {
      socket.to(roomId).emit('output-update', { output });
    });
    
    // Language changes from teacher to students
    socket.on('language-change', ({ roomId, language }) => {
      socket.to(roomId).emit('language-update', { language });
    });
    
    // Input changes from teacher to students
    socket.on('input-change', ({ roomId, input }) => {
      socket.to(roomId).emit('input-update', { input });
    });
    
    // Submission status from students to teacher
    socket.on('submission-status', ({ roomId, status, testCaseId }) => {
      // Update student status for this test case
      if (studentStatus[roomId]) {
        if (!studentStatus[roomId][testCaseId]) {
          studentStatus[roomId][testCaseId] = {};
        }
        studentStatus[roomId][testCaseId][socket.id] = status;
        
        // Emit updated status to room (primarily for teacher)
        io.to(roomId).emit('submission-update', { 
          testCaseId,
          studentId: socket.id,
          status,
          statusMap: studentStatus[roomId][testCaseId]
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected:', socket.id);
      
      // Remove from all active rooms
      if (currentRoom) {
        if (activeStudents[currentRoom]) {
          activeStudents[currentRoom].delete(socket.id);
          
          // Emit updated student list
          io.to(currentRoom).emit('student-update', { 
            students: Array.from(activeStudents[currentRoom])
          });
        }
      }
    });
  });
};

export default initializeSocket;
