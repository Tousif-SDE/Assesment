// Server/controllers/testCaseController.js
import prisma from '../prisma/prismaClient.js';

export const createTestCase = async (req, res) => {
  try {
    const { roomId, input, expectedOutput, title } = req.body;
    const userId = req.user.id; // can be teacher or student

    // Check if the room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Generate a UUID for the test case ID
    const { v4: uuidv4 } = await import('uuid');
    const testCaseId = uuidv4();

    // Create the test case
    const testCase = await prisma.testcase.create({
      data: {
        id: testCaseId,
        roomId,
        input,
        expectedOutput,
        title: title || 'Untitled Test Case', // Use provided title or default
        createdBy: userId,
      },
    });

    res.status(201).json(testCase);
  } catch (err) {
    console.error('Error creating test case:', err);
    res.status(500).json({ error: 'Failed to create test case', details: err.message });
  }
};

export const getTestCasesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if the room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // For teachers, return all test case details
    // For students, hide the expected output
    const testCases = await prisma.testcase.findMany({
      where: { roomId },
      select: {
        id: true,
        input: true,
        expectedOutput: userRole === 'TEACHER', // Only include expectedOutput for teachers
        createdAt: true,
        createdBy: true,
        title: true, // Include title field
      },
    });

    // For students, check which test cases they've solved
    if (userRole === 'STUDENT') {
      // Get all submissions by this student for test cases in this room
      const submissions = await prisma.submission.findMany({
        where: {
          studentId: userId,
          testcase: {
            roomId,
          },
          status: 'Solved',
        },
        select: {
          testCaseId: true,
        },
      });

      // Create a set of solved test case IDs
      const solvedTestCaseIds = new Set(submissions.map(s => s.testCaseId));

      // Add a 'solved' flag to each test case
      const testCasesWithSolvedStatus = testCases.map(tc => ({
        ...tc,
        solved: solvedTestCaseIds.has(tc.id),
      }));

      return res.json(testCasesWithSolvedStatus);
    }

    res.json(testCases);
  } catch (err) {
    console.error('Error fetching test cases:', err);
    res.status(500).json({ error: 'Failed to fetch test cases', details: err.message });
  }
};
