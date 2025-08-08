import prisma from '../prisma/prismaClient.js';

export const createRoom = async (req, res) => {
  const {
    roomName,
    subject,
    batchYear,
    college,
    totalStudents,
    totalDuration,
    code
  } = req.body;

  // Allow only TEACHERS
  if (req.user.role !== 'TEACHER') {
    return res.status(403).json({ message: 'Only TEACHERs can create rooms' });
  }

  // Check if code already exists
  const existingRoom = await prisma.room.findUnique({ where: { code } });

  if (existingRoom) {
    return res.status(409).json({
      message: 'Room code already exists',
      error: 'A room with this code already exists. Please choose a different code.'
    });
  }

  const room = await prisma.room.create({
    data: {
      roomName,
      subject,
      batchYear,
      college,
      totalStudents,
      totalDuration,
      code,
      createdBy: req.user.id, // <-- set teacher ID here
    },
  });

  res.status(201).json(room);
};
