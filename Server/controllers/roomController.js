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
    const { v4: uuidv4 } = await import('uuid');
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
      return res.status(400).json({ message: 'Already joined this room' });
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
