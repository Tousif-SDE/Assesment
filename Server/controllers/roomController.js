import prisma from '../prisma/prismaClient.js';
import { v4 as uuidv4 } from 'uuid';

// ✅ Teacher creates a room
export const createRoom = async (req, res) => {
  try {
    const {
      roomName,
      subject,
      batchYear,
      college,
      totalStudents,
      totalDuration,
      code,
      tutor // Add tutor field from the form
    } = req.body;

    // Generate a UUID for the room ID
    const roomId = uuidv4();

    const newRoom = await prisma.room.create({
      data: {
        id: roomId, // Set explicit ID
        roomName: roomName || tutor, // Use tutor as roomName if not provided
        subject,
        batchYear,
        college,
        totalStudents,
        totalDuration,
        code,
        updatedAt: new Date(),
        // ✅ Correct relation name in schema
        user: { connect: { id: req.user.id } }
      },
      include: {
        user: true // Will return teacher info
      }
    });

    res.status(201).json(newRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Error creating room',
      error: error.message
    });
  }
};

// ✅ Teacher gets their own rooms
export const getMyRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { teacherId: req.user.id },
      include: {
        user: true
      }
    });
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Error fetching rooms',
      error: error.message
    });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { code } = req.body;
    const studentId = req.user.id;

    const room = await prisma.room.findFirst({
      where: { code },
      include: {
        user: true,
        roomparticipant: true  // fixed relation name
      }
    });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const alreadyJoined = await prisma.roomparticipant.findFirst({
      where: { roomId: room.id, studentId }
    });

    if (alreadyJoined) {
      // Allow rejoining - return success with room info
      return res.json({ message: 'Already joined this room', room });
    }

    await prisma.roomparticipant.create({
      data: {
        id: uuidv4(),   // generate id here
        roomId: room.id,
        studentId
      }
    });

    res.json({ message: 'Joined successfully', room });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Error joining room',
      error: error.message
    });
  }
};

// ✅ Submission create example with correct relation field name
export const createSubmission = async (req, res) => {
  try {
    const { studentId, code, output, status, timeTaken, testCaseId } = req.body;

    const submission = await prisma.submission.create({
      data: {
        id: uuidv4(),
        studentId,
        code,
        output,
        status,
        timeTaken, // ✅ this now exists in schema
        testcase: { connect: { id: testCaseId } } // ✅ matches relation name in schema
      }
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Failed to submit code',
      details: error.message
    });
  }
};

// Delete a room and all associated data
export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const teacherId = req.user.id;

    // Verify that the teacher owns this room
    const room = await prisma.room.findFirst({
      where: { 
        id: roomId,
        teacherId 
      },
    });

    if (!room) {
      return res.status(403).json({ error: 'Not authorized to delete this room' });
    }

    // Delete all related data in the correct order to maintain referential integrity
    // 1. First delete all submissions related to test cases in this room
    await prisma.submission.deleteMany({
      where: {
        testcase: {
          roomId
        }
      }
    });

    // 2. Delete all test cases in this room
    await prisma.testcase.deleteMany({
      where: { roomId }
    });

    // 3. Delete all room participants
    await prisma.roomparticipant.deleteMany({
      where: { roomId }
    });

    // 4. Finally delete the room itself
    await prisma.room.delete({
      where: { id: roomId }
    });

    // If socket manager is available, notify clients that the room has been deleted
    if (req.app.get('socketManager')) {
      const socketManager = req.app.get('socketManager');
      socketManager.io.to(roomId).emit('room-deleted', { roomId, message: 'This room has been deleted by the teacher' });
    }

    res.json({ message: 'Room deleted successfully', roomId });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      error: 'Failed to delete room',
      details: error.message
    });
  }
};
