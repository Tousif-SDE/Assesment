import prisma from '../prisma/prismaClient.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // ✅ Moved import here

// ✅ Create Submission
export const createSubmission = async (req, res) => {
  try {
    const { testCaseId, code, language, timeTaken } = req.body;
    const studentId = req.user.id;

    const testCase = await prisma.testcase.findUnique({
      where: { id: testCaseId },
    });
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }

    const response = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
      {
        source_code: code,
        language_id: language,
        stdin: testCase.input,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        },
      }
    );

    const actualOutput = response.data.stdout?.trim() || '';
    const expected = testCase.expectedOutput.trim();
    const status = actualOutput === expected ? 'Solved' : 'Not Solved';

    const submission = await prisma.submission.create({
      data: {
        id: uuidv4(),
        studentId,
        code,
        output: actualOutput,
        status,
        timeTaken: timeTaken || 0, // Store the time taken to solve the test case
        // ✅ Use correct relation name
        testcase: { 
          connect: { id: testCaseId }
        }
      },
    });

    res.status(201).json({ submission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit code', details: err.message });
  }
};

// ✅ Get Submissions by Student
export const getSubmissionsByStudent = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await prisma.submission.findMany({
      where: { studentId },
      include: {
        // ✅ Correct relation name from schema
        testcase: { 
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            roomId: true,
            title: true,
          },
        },
        // ✅ Correct relation for user
        user: { 
          select: { name: true },
        },
      },
    });

    if (!submissions.length) {
      return res.json({
        totalActive: 0,
        totalAttempted: 0,
        totalSolved: 0,
        solvedTestCases: [],
        submissions: [],
      });
    }

    const roomId = submissions[0].testcase.roomId;

    const allTestCases = await prisma.testcase.findMany({
      where: { roomId },
    });

    const totalActive = allTestCases.length;
    const totalAttempted = submissions.length;
    const totalSolved = submissions.filter(sub => sub.status === 'Solved').length;

    const solvedTestCases = submissions
      .filter(sub => sub.status === 'Solved')
      .map(sub => ({
        id: sub.testcase.id,
        input: sub.testcase.input,
        expectedOutput: sub.testcase.expectedOutput,
        title: sub.testcase.title,
      }));

    res.json({
      totalActive,
      totalAttempted,
      totalSolved,
      solvedTestCases,
      submissions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get submissions', details: err.message });
  }
};

// Get Submissions by Room (for teacher statistics)
export const getSubmissionsByRoom = async (req, res) => {
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
      return res.status(403).json({ error: 'Not authorized to access this room' });
    }

    // Get all test cases for this room
    const testCases = await prisma.testcase.findMany({
      where: { roomId },
    });

    // Get all submissions for this room
    const submissions = await prisma.submission.findMany({
      where: {
        testcase: {
          roomId,
        },
      },
      include: {
        testcase: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate statistics
    const totalTestCases = testCases.length;
    
    // Group submissions by student
    const studentSubmissions = {};
    submissions.forEach(sub => {
      if (!studentSubmissions[sub.studentId]) {
        studentSubmissions[sub.studentId] = {
          student: sub.user,
          submissions: [],
          solved: 0,
          attempted: 0,
          averageTime: 0,
          totalTime: 0,
        };
      }
      
      studentSubmissions[sub.studentId].submissions.push(sub);
      
      // Count unique test cases attempted
      const testCaseIds = new Set(studentSubmissions[sub.studentId].submissions.map(s => s.testcase.id));
      studentSubmissions[sub.studentId].attempted = testCaseIds.size;
      
      // Add to total time if solved
      if (sub.status === 'Solved') {
        studentSubmissions[sub.studentId].totalTime += sub.timeTaken || 0;
      }
    });
    
    // Calculate solved count and average time for each student
    Object.values(studentSubmissions).forEach(student => {
      // Get unique solved test cases
      const solvedTestCaseIds = new Set();
      student.submissions.forEach(sub => {
        if (sub.status === 'Solved') {
          solvedTestCaseIds.add(sub.testcase.id);
        }
      });
      
      // Set solved count
      student.solved = solvedTestCaseIds.size;
      
      // Calculate average time
      const solvedSubmissions = student.submissions.filter(sub => sub.status === 'Solved');
      student.averageTime = solvedSubmissions.length > 0 
        ? Math.round(student.totalTime / solvedSubmissions.length) 
        : 0;
    });

    res.json({
      totalTestCases,
      students: Object.values(studentSubmissions),
      testCases,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get room submissions', details: err.message });
  }
};
