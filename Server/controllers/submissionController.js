import prisma from '../prisma/prismaClient.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // ✅ Moved import here

// Helper function to get teacher dashboard data for a specific room
async function getTeacherDashboardData(roomId) {
  // Define the active time window in minutes - configurable via environment variable
  const ACTIVE_TIME_WINDOW_MINUTES = parseInt(process.env.ACTIVE_TIME_WINDOW_MINUTES || '30', 10);
  
  // Calculate the timestamp for active students (last X minutes)
  const activeTimeWindow = new Date();
  activeTimeWindow.setMinutes(activeTimeWindow.getMinutes() - ACTIVE_TIME_WINDOW_MINUTES);

  // Get all submissions for this room
  const submissions = await prisma.submission.findMany({
    where: {
      testcase: {
        roomId,
      },
      createdAt: { gte: activeTimeWindow }
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

  // Get all test cases for this room
  const testCases = await prisma.testcase.findMany({
    where: { roomId },
  });

  // Calculate dashboard statistics
  // 1. Active students (submitted within time window)
  const activeStudentIds = new Set(submissions.map(sub => sub.studentId));
  const totalActive = activeStudentIds.size;

  // 2. Total attempted test cases
  const attemptedTestCaseIds = new Set(submissions.map(sub => sub.testCaseId));
  const totalAttempted = attemptedTestCaseIds.size;

  // 3. Total solved test cases
  const solvedSubmissions = submissions.filter(sub => sub.status === 'Solved');
  const solvedTestCaseIds = new Set(solvedSubmissions.map(sub => sub.testCaseId));
  const totalSolved = solvedTestCaseIds.size;

  // 4. List of solved test cases with details
  const solvedTestCases = solvedSubmissions.map(sub => ({
    testCaseId: sub.testCaseId,
    studentId: sub.studentId,
    studentName: sub.user?.name || 'Unknown Student',
    timestamp: sub.createdAt,
    status: sub.status,
    timeTaken: sub.timeTaken || 0
  }));

  // 5. Format all submissions for the response
  const formattedSubmissions = submissions.map(sub => ({
    id: sub.id,
    testCaseId: sub.testCaseId,
    testCaseTitle: sub.testcase?.title || 'Unknown Test Case',
    studentId: sub.studentId,
    studentName: sub.user?.name || 'Unknown Student',
    status: sub.status,
    output: sub.output,
    createdAt: sub.createdAt,
    timeTaken: sub.timeTaken || 0
  }));

  // Prepare and return the dashboard data
  return {
    totalActive,
    totalAttempted,
    totalSolved,
    solvedTestCases,
    submissions: formattedSubmissions,
    activeTimeWindowMinutes: ACTIVE_TIME_WINDOW_MINUTES
  };
}

// ✅ Create Submission
export const createSubmission = async (req, res) => {
  try {
    // Validate request body
    const { testCaseId, code, language, timeTaken } = req.body;
    
    if (!testCaseId) {
      return res.status(400).json({ error: 'Test case ID is required' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    if (!language) {
      return res.status(400).json({ error: 'Language ID is required' });
    }
    
    // Validate user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const studentId = req.user.id;
    
    // Find the test case
    let testCase;
    try {
      testCase = await prisma.testcase.findUnique({
        where: { id: testCaseId },
        include: { room: true }
      });
    } catch (prismaError) {
      console.error('Prisma error fetching test case:', prismaError);
      return res.status(500).json({ 
        error: 'Database error while fetching test case', 
        details: prismaError.message 
      });
    }
    
    if (!testCase) {
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    // Check if Judge0 API key is configured
    if (!process.env.JUDGE0_API_KEY) {
      console.error('JUDGE0_API_KEY is not configured in environment variables');
      return res.status(500).json({ 
        error: 'Code execution service is not properly configured', 
        details: 'Missing API key configuration'
      });
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    let response;
    try {
      response = await axios.post(
        'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true',
        {
          source_code: code,
          language_id: language,
          stdin: testCase.input || '',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
    } catch (axiosError) {
      clearTimeout(timeoutId);
      console.error('Error calling Judge0 API:', axiosError);
      
      if (axiosError.name === 'AbortError') {
        return res.status(504).json({ error: 'Code execution timed out' });
      }
      
      if (axiosError.response) {
        return res.status(axiosError.response.status).json({ 
          error: 'Code execution service error', 
          details: axiosError.response.data
        });
      } else if (axiosError.request) {
        return res.status(503).json({ 
          error: 'Code execution service unavailable', 
          details: 'No response from execution service'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to execute code', 
        details: axiosError.message || 'Unknown error'
      });
    }
    
    // Process the response with null checks
    const actualOutput = response?.data?.stdout?.trim() || '';
    const expected = testCase?.expectedOutput?.trim() || '';
    const status = actualOutput === expected ? 'Solved' : 'Not Solved';
    
    // Create the submission record
    let submission;
    try {
      submission = await prisma.submission.create({
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
        include: {
          testcase: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });
    } catch (prismaError) {
      console.error('Prisma error creating submission:', prismaError);
      return res.status(500).json({ 
        error: 'Database error while creating submission', 
        details: prismaError.message 
      });
    }

    // Get updated dashboard data for real-time updates
    const roomId = testCase.roomId;
    
    // Get dashboard data with error handling
    let teacherDashboardData;
    try {
      teacherDashboardData = await getTeacherDashboardData(roomId);
    } catch (dashboardError) {
      console.error('Error getting teacher dashboard data:', dashboardError);
      // Continue with the submission process even if dashboard data fails
      // This is non-critical functionality
    }
    
    // Emit real-time event with updated dashboard data
    try {
      if (req.app.get('socketManager')) {
        const socketManager = req.app.get('socketManager');
        
        // Emit detailed submission data for real-time updates
        const submissionDetails = {
          id: submission.id,
          testCaseId: submission.testcase?.id,
          testCaseTitle: submission.testcase?.title || 'Unknown Test Case',
          studentId: submission.studentId,
          studentName: submission.user?.name || 'Unknown Student',
          studentEmail: submission.user?.email,
          status: submission.status,
          output: submission.output,
          createdAt: submission.createdAt,
          timeTaken: submission.timeTaken || 0
        };
        
        // Broadcast submission update to all clients in the room
        socketManager.io.to(roomId).emit('submission-update', submissionDetails);
        
        // Also send the full dashboard update if available
        if (teacherDashboardData) {
          socketManager.io.to(roomId).emit('teacherDashboardUpdate', teacherDashboardData);
        }
      }
    } catch (socketError) {
      console.error('Error emitting socket events:', socketError);
      // Continue with the submission process even if socket emission fails
      // This is non-critical functionality
    }

    // Return the successful response
    console.log(`Successfully created submission ${submission.id} for student ${studentId}`);
    return res.status(201).json({ submission });
  } catch (err) {
    console.error('Unexpected error in createSubmission:', err);
    return res.status(500).json({ 
      error: 'Failed to submit code', 
      details: err.message || 'Unknown error occurred'
    });
  }
};

// ✅ Get Submissions by Student
export const getSubmissionsByStudent = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const studentId = req.user.id;
    console.log(`Fetching submissions for student ID: ${studentId}`);

    // Get all submissions for this student with proper error handling
    let submissions;
    try {
      submissions = await prisma.submission.findMany({
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
    } catch (prismaError) {
      console.error('Prisma error fetching submissions:', prismaError);
      return res.status(500).json({ 
        error: 'Database error while fetching submissions', 
        details: prismaError.message 
      });
    }

    // Handle case with no submissions
    if (!submissions || !submissions.length) {
      console.log(`No submissions found for student ID: ${studentId}`);
      return res.json({
        totalActive: 0,
        totalAttempted: 0,
        totalSolved: 0,
        solvedTestCases: [],
        submissions: [],
      });
    }

    // Safely access roomId with null checks
    const roomId = submissions[0]?.testcase?.roomId;
    if (!roomId) {
      console.error(`Invalid room ID for student ${studentId}'s submissions`);
      return res.status(500).json({ 
        error: 'Invalid data structure in submissions', 
        details: 'Could not determine room ID from submissions' 
      });
    }

    // Get all test cases for this room with proper error handling
    let allTestCases;
    try {
      allTestCases = await prisma.testcase.findMany({
        where: { roomId },
      });
    } catch (prismaError) {
      console.error('Prisma error fetching test cases:', prismaError);
      return res.status(500).json({ 
        error: 'Database error while fetching test cases', 
        details: prismaError.message 
      });
    }

    // Calculate statistics with null checks
    const totalActive = allTestCases?.length || 0;
    const totalAttempted = submissions?.length || 0;
    const totalSolved = submissions?.filter(sub => sub?.status === 'Solved')?.length || 0;

    // Process solved test cases with null checks
    const solvedTestCases = submissions
      ?.filter(sub => sub?.status === 'Solved')
      ?.map(sub => ({
        id: sub?.testcase?.id,
        input: sub?.testcase?.input,
        expectedOutput: sub?.testcase?.expectedOutput,
        title: sub?.testcase?.title,
      })) || [];

    // Return the response
    console.log(`Successfully retrieved ${submissions.length} submissions for student ID: ${studentId}`);
    return res.json({
      totalActive,
      totalAttempted,
      totalSolved,
      solvedTestCases,
      submissions,
      activeTimeWindowMinutes: parseInt(process.env.ACTIVE_TIME_WINDOW_MINUTES || '30', 10)
    });
  } catch (err) {
    console.error('Unexpected error in getSubmissionsByStudent:', err);
    return res.status(500).json({ 
      error: 'Failed to get submissions', 
      details: err.message || 'Unknown error occurred'
    });
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
      activeTimeWindowMinutes: ACTIVE_TIME_WINDOW_MINUTES
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get room submissions', details: err.message });
  }
};
