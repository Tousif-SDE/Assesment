import prisma from '../prisma/prismaClient.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import redis from '../redis/redisClient.js';

// ✅ FIXED: Improved executeCode function with proper polling and timeout handling
async function executeCode(code, languageId, input) {
  if (!process.env.JUDGE0_API_KEY) {
    throw new Error('Code execution service is not properly configured');
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second overall timeout
  
  try {
    console.log('📤 Executing code with Judge0 API...');
    
    // ✅ FIXED: Use the correct API endpoint without wait=true for better reliability
    const submitResponse = await axios.post(
      'https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=false',
      {
        source_code: code,
        language_id: languageId,
        stdin: input || '',
        expected_output: null, // Let us handle comparison manually
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
        },
        signal: controller.signal,
        timeout: 10000 // 10 second timeout for submission
      }
    );
    
    const token = submitResponse.data.token;
    console.log('✅ Got submission token:', token);
    
    if (!token) {
      throw new Error('No token received from Judge0 API');
    }
    
    // ✅ FIXED: Enhanced polling with better error handling and timeout
    let result = null;
    let attempts = 0;
    const maxAttempts = 60; // Increased to 60 attempts (60 seconds max)
    const pollInterval = 1000; // 1 second between polls
    
    while (attempts < maxAttempts) {
      try {
        const resultResponse = await axios.get(
          `https://judge0-ce.p.rapidapi.com/submissions/${token}?base64_encoded=false&fields=*`,
          {
            headers: {
              'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
              'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
            },
            timeout: 5000, // 5 second timeout for each poll
            signal: controller.signal
          }
        );
        
        result = resultResponse.data;
        const statusId = result.status?.id;
        const statusDescription = result.status?.description;
        
        console.log(`🔄 Poll ${attempts + 1}: Status ID = ${statusId}, Description = ${statusDescription}`);
        
        // ✅ FIXED: Better status handling
        // Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4=Wrong Answer, 5=Time Limit Exceeded,
        // 6=Compilation Error, 7=Runtime Error (SIGSEGV), 8=Runtime Error (SIGXFSZ), 
        // 9=Runtime Error (SIGFPE), 10=Runtime Error (SIGABRT), 11=Runtime Error (NZEC), 
        // 12=Runtime Error (Other), 13=Internal Error, 14=Exec Format Error
        
        if (statusId && statusId >= 3) {
          // Execution completed (either success or error)
          console.log('✅ Execution completed with status:', statusDescription);
          break;
        }
        
        if (statusId === 1 || statusId === 2) {
          // Still processing, continue polling
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          attempts++;
          continue;
        }
        
        // Unknown status, continue polling but log warning
        console.warn(`⚠️ Unknown status ID: ${statusId}, continuing...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
        
      } catch (pollError) {
        console.error(`❌ Poll ${attempts + 1} error:`, pollError.message);
        
        if (pollError.name === 'AbortError') {
          throw new Error('Code execution timeout');
        }
        
        // If it's a network error, wait a bit longer and try again
        if (attempts < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
          attempts++;
          continue;
        } else {
          throw pollError;
        }
      }
    }
    
    clearTimeout(timeoutId);
    
    if (attempts >= maxAttempts) {
      throw new Error('Code execution timeout - exceeded maximum polling attempts');
    }
    
    if (!result) {
      throw new Error('No execution result received');
    }
    
    // ✅ FIXED: Enhanced response processing
    const processedResult = {
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compile_output: result.compile_output || '',
      time: parseFloat(result.time || 0),
      memory: parseInt(result.memory || 0),
      exit_code: result.exit_code,
      exit_signal: result.exit_signal,
      token: result.token
    };
    
    console.log('✅ Execution completed successfully:', {
      status: processedResult.status?.description,
      hasOutput: !!processedResult.stdout,
      hasError: !!processedResult.stderr,
      hasCompileError: !!processedResult.compile_output
    });
    
    return processedResult;
    
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Code execution error:', error.message);
    
    if (error.name === 'AbortError') {
      throw new Error('Code execution timed out');
    }
    
    if (error.response) {
      console.error('API Error Response:', error.response.status, error.response.data);
      throw new Error(`Judge0 API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

// Check if Redis is connected
const isRedisConnected = () => {
  return redis && redis.isReady && redis.isOpen;
};

// Helper function to get teacher dashboard data for a specific room
async function getTeacherDashboardData(roomId) {
  const ACTIVE_TIME_WINDOW_MINUTES = parseInt(process.env.ACTIVE_TIME_WINDOW_MINUTES || '30', 10);
  
  const activeTimeWindow = new Date();
  activeTimeWindow.setMinutes(activeTimeWindow.getMinutes() - ACTIVE_TIME_WINDOW_MINUTES);

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

  const testCases = await prisma.testcase.findMany({
    where: { roomId },
  });

  const activeStudentIds = new Set(submissions.map(sub => sub.studentId));
  const totalActive = activeStudentIds.size;

  const attemptedTestCaseIds = new Set(submissions.map(sub => sub.testCaseId));
  const totalAttempted = attemptedTestCaseIds.size;

  const solvedSubmissions = submissions.filter(sub => sub.status === 'Solved');
  const solvedTestCaseIds = new Set(solvedSubmissions.map(sub => sub.testCaseId));
  const totalSolved = solvedTestCaseIds.size;

  const solvedTestCases = solvedSubmissions.map(sub => ({
    testCaseId: sub.testCaseId,
    studentId: sub.studentId,
    studentName: sub.user?.name || 'Unknown Student',
    timestamp: sub.createdAt,
    status: sub.status,
    timeTaken: sub.timeTaken || 0
  }));

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

  return {
    totalActive,
    totalAttempted,
    totalSolved,
    solvedTestCases,
    submissions: formattedSubmissions,
    activeTimeWindowMinutes: ACTIVE_TIME_WINDOW_MINUTES
  };
}

// ✅ FIXED: Create Submission with improved error handling and code execution
export const createSubmission = async (req, res) => {
  try {
    const { testCaseId, code, language, timeTaken } = req.body;
    
    // Validate request body
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
    
    // Get Redis client from app
    const redisClient = req.app.get('redisClient');
    
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
    
    // Try to get the test case from Redis first for faster access
    let expectedOutput = testCase.expectedOutput;
    if (redisClient && redisClient.isReady) {
      try {
        const redisTestCase = await redisClient.get(`testcase:${testCase.roomId}:${testCaseId}`);
        if (redisTestCase) {
          const parsedTestCase = JSON.parse(redisTestCase);
          if (parsedTestCase.expectedOutput) {
            expectedOutput = parsedTestCase.expectedOutput;
            console.log('Using expected output from Redis cache');
          }
        }
      } catch (redisErr) {
        console.error('Error retrieving test case from Redis:', redisErr);
      }
    }
    
    // ✅ FIXED: Use the improved executeCode function
    let executionResult;
    try {
      console.log('🚀 Starting code execution...');
      executionResult = await executeCode(code, language, testCase.input || '');
      console.log('✅ Code execution completed successfully');
    } catch (executionError) {
      console.error('❌ Code execution failed:', executionError);
      return res.status(500).json({ 
        error: 'Code execution failed', 
        details: executionError.message 
      });
    }
    
    // ✅ FIXED: Enhanced result processing with better error handling
    let actualOutput = '';
    let executionStatus = 'Runtime Error';
    let errorDetails = null;
    
    const statusId = executionResult.status?.id;
    const statusDescription = executionResult.status?.description;
    
    console.log(`Processing execution result - Status: ${statusId} (${statusDescription})`);
    
    // Handle different execution outcomes
    if (executionResult.compile_output && executionResult.compile_output.trim()) {
      // Compilation error
      actualOutput = 'Compilation Error';
      executionStatus = 'Compilation Error';
      errorDetails = executionResult.compile_output.trim();
      console.log('❌ Compilation error detected');
    } else if (statusId === 3) {
      // Accepted/Success
      actualOutput = (executionResult.stdout || '').trim();
      executionStatus = 'Success';
      console.log('✅ Code executed successfully');
    } else if (statusId === 5) {
      // Time Limit Exceeded
      actualOutput = 'Time Limit Exceeded';
      executionStatus = 'Time Limit Exceeded';
      errorDetails = 'Code execution exceeded time limit';
      console.log('⏰ Time limit exceeded');
    } else if (statusId === 6) {
      // Compilation Error (alternative status)
      actualOutput = 'Compilation Error';
      executionStatus = 'Compilation Error';
      errorDetails = executionResult.compile_output || executionResult.stderr || 'Unknown compilation error';
      console.log('❌ Compilation error (status 6)');
    } else if (statusId >= 7 && statusId <= 12) {
      // Runtime Error variants
      actualOutput = 'Runtime Error';
      executionStatus = 'Runtime Error';
      errorDetails = executionResult.stderr || statusDescription || 'Unknown runtime error';
      console.log('❌ Runtime error detected');
    } else if (executionResult.stderr && executionResult.stderr.trim()) {
      // Runtime error with stderr
      actualOutput = 'Runtime Error';
      executionStatus = 'Runtime Error';
      errorDetails = executionResult.stderr.trim();
      console.log('❌ Runtime error with stderr');
    } else if (statusId === 4) {
      // Wrong Answer
      actualOutput = (executionResult.stdout || '').trim();
      executionStatus = 'Wrong Answer';
      console.log('❌ Wrong answer');
    } else {
      // Other cases - try to get output
      actualOutput = (executionResult.stdout || '').trim();
      executionStatus = statusDescription || 'Unknown';
      console.log(`⚠️ Unknown status, got output: "${actualOutput}"`);
    }
    
    // Compare with expected output only if execution was successful
    const expected = (expectedOutput || '').trim();
    let submissionStatus = 'Not Solved';
    
    if (executionStatus === 'Success' && actualOutput === expected) {
      submissionStatus = 'Solved';
      console.log('🎉 Test case solved correctly!');
    } else {
      console.log(`❌ Test case not solved. Status: ${executionStatus}, Output: "${actualOutput}", Expected: "${expected}"`);
    }
    
    // Create the submission record
    let submission;
    try {
      submission = await prisma.submission.create({
        data: {
          id: uuidv4(),
          studentId,
          userId: studentId,
          code,
          output: actualOutput,
          status: submissionStatus,
          timeTaken: timeTaken || 0,
          testCaseId: testCaseId,
          errorDetails: errorDetails, // Store error details if available
          executionTime: executionResult.time || 0,
          memoryUsed: executionResult.memory || 0
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
      
      console.log(`✅ Created submission ${submission.id} with status: ${submissionStatus}`);
      
      // Update progress statistics in Redis
      if (redisClient && redisClient.isReady) {
        try {
          const roomId = testCase.roomId;
          const progressKey = `progress:${roomId}:${studentId}`;
          
          let progress = {};
          const existingProgress = await redisClient.get(progressKey);
          
          if (existingProgress) {
            progress = JSON.parse(existingProgress);
          } else {
            progress = {
              attempted: [],
              solved: [],
              submissions: []
            };
          }
          
          const attempted = new Set(Array.isArray(progress.attempted) ? progress.attempted : []);
          const solved = new Set(Array.isArray(progress.solved) ? progress.solved : []);
          
          attempted.add(testCaseId);
          if (submissionStatus === 'Solved') {
            solved.add(testCaseId);
          }
          
          const submissions = Array.isArray(progress.submissions) ? progress.submissions : [];
          submissions.unshift({
            id: submission.id,
            testCaseId,
            status: submissionStatus,
            timestamp: new Date().toISOString()
          });
          
          if (submissions.length > 10) {
            submissions.pop();
          }
          
          await redisClient.set(progressKey, JSON.stringify({
            attempted: Array.from(attempted),
            solved: Array.from(solved),
            submissions
          }));
          
          console.log(`Updated progress for student ${studentId} in room ${roomId}`);
        } catch (redisErr) {
          console.error('Failed to update progress in Redis:', redisErr);
        }
      }
    } catch (prismaError) {
      console.error('Prisma error creating submission:', prismaError);
      return res.status(500).json({ 
        error: 'Database error while creating submission', 
        details: prismaError.message 
      });
    }

    // Get updated dashboard data for real-time updates
    const roomId = testCase.roomId;
    
    let teacherDashboardData;
    try {
      teacherDashboardData = await getTeacherDashboardData(roomId);
    } catch (dashboardError) {
      console.error('Error getting teacher dashboard data:', dashboardError);
    }
    
    // Store submission data in Redis for persistence and sync
    try {
      if (isRedisConnected()) {
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
          timeTaken: submission.timeTaken || 0,
          errorDetails: submission.errorDetails,
          executionTime: submission.executionTime || 0,
          memoryUsed: submission.memoryUsed || 0
        };
        
        const submissionKey = `submission:${roomId}:${submission.id}`;
        await redis.set(submissionKey, JSON.stringify(submissionDetails));
        
        const roomSubmissionsKey = `submissions:${roomId}`;
        const existingSubmissions = await redis.get(roomSubmissionsKey);
        const submissions = existingSubmissions ? JSON.parse(existingSubmissions) : [];
        submissions.push(submissionDetails);
        await redis.set(roomSubmissionsKey, JSON.stringify(submissions));
        
        if (teacherDashboardData) {
          const dashboardKey = `dashboard:${roomId}`;
          await redis.set(dashboardKey, JSON.stringify(teacherDashboardData));
        }
        
        console.log(`Stored submission in Redis for room ${roomId}:`, submission.id);
      }
    } catch (redisErr) {
      console.error('Failed to store submission in Redis:', redisErr);
    }
    
    // Emit real-time event with updated dashboard data
    try {
      if (req.app.get('socketManager')) {
        const socketManager = req.app.get('socketManager');
        
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
          timeTaken: submission.timeTaken || 0,
          errorDetails: submission.errorDetails,
          executionTime: submission.executionTime || 0,
          memoryUsed: submission.memoryUsed || 0
        };
        
        socketManager.io.to(roomId).emit('submission-update', submissionDetails);
        
        if (teacherDashboardData) {
          socketManager.io.to(roomId).emit('teacherDashboardUpdate', teacherDashboardData);
        }
      }
    } catch (socketError) {
      console.error('Error emitting socket events:', socketError);
    }

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

// Get Submissions by Student
export const getSubmissionsByStudent = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const studentId = req.user.id;
    console.log(`Fetching submissions for student ID: ${studentId}`);

    let submissions;
    try {
      submissions = await prisma.submission.findMany({
        where: { 
          OR: [
            { studentId: studentId },
            { userId: studentId }
          ]
        },
        include: {
          testcase: { 
            select: {
              id: true,
              input: true,
              expectedOutput: true,
              roomId: true,
              title: true,
            },
          },
          user: { 
            select: { 
              id: true,
              name: true 
            },
          },
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (prismaError) {
      console.error('Prisma error fetching submissions:', prismaError);
      return res.status(500).json({ 
        error: 'Database error while fetching submissions', 
        details: prismaError.message 
      });
    }

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

    const roomId = submissions[0]?.testcase?.roomId;
    if (!roomId) {
      console.error(`Invalid room ID for student ${studentId}'s submissions`);
      return res.status(500).json({ 
        error: 'Invalid data structure in submissions', 
        details: 'Could not determine room ID from submissions' 
      });
    }

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

    const totalActive = allTestCases?.length || 0;
    const uniqueTestCases = new Set(submissions.map(sub => sub.testCaseId));
    const totalAttempted = uniqueTestCases.size;
    const totalSolved = submissions?.filter(sub => sub?.status === 'Solved')?.length || 0;

    const solvedTestCases = submissions
      ?.filter(sub => sub?.status === 'Solved')
      ?.map(sub => ({
        id: sub?.testcase?.id,
        input: sub?.testcase?.input,
        expectedOutput: sub?.testcase?.expectedOutput,
        title: sub?.testcase?.title,
      })) || [];

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

// ✅ FIXED: Run test with improved executeCode function
export const runTest = async (req, res) => {
  try {
    const { testCaseId, code, language } = req.body;
    
    if (!testCaseId) {
      return res.status(400).json({ error: 'Test case ID is required' });
    }
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    if (!language) {
      return res.status(400).json({ error: 'Language ID is required' });
    }
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log(`Looking for test case with ID: ${testCaseId}`);
    
    if (!testCaseId || typeof testCaseId !== 'string' || testCaseId.trim() === '') {
      console.error('Invalid test case ID format:', testCaseId);
      return res.status(400).json({ error: 'Invalid test case ID format' });
    }
    
    let testCase;
    try {
      testCase = await prisma.testcase.findUnique({
        where: { id: testCaseId },
        include: { room: true }
      });
      
      console.log(`Test case lookup result:`, testCase ? 'Found' : 'Not found');
    } catch (dbError) {
      console.error('Database error when finding test case:', dbError);
      return res.status(500).json({ 
        error: 'Database error when finding test case', 
        details: dbError.message 
      });
    }
    
    if (!testCase) {
      console.error(`Test case with ID ${testCaseId} not found in database`);
      return res.status(404).json({ error: 'Test case not found' });
    }
    
    // ✅ FIXED: Use the improved executeCode function
    try {
      console.log(`Executing code for test case ${testCase.id} with language ${language}`);
      
      const executionResult = await executeCode(code, language, testCase.input || '');
      console.log('Judge0 execution completed');
      
      let actualOutput = '';
      let error = null;
      let passed = false;
      
      const statusId = executionResult.status?.id;
      const statusDescription = executionResult.status?.description;
      
      // Process execution results
      if (executionResult.compile_output && executionResult.compile_output.trim()) {
        error = `Compilation Error: ${executionResult.compile_output}`;
        actualOutput = 'Compilation Error';
        console.log('Compilation error:', executionResult.compile_output);
      } else if (statusId === 3) {
        // Accepted
        actualOutput = (executionResult.stdout || '').trim();
        console.log('Execution output:', actualOutput);
      } else if (statusId === 5) {
        error = 'Time Limit Exceeded';
        actualOutput = 'Time Limit Exceeded';
        console.log('Time limit exceeded');
      } else if (statusId === 6) {
        error = `Compilation Error: ${executionResult.compile_output || 'Unknown compilation error'}`;
        actualOutput = 'Compilation Error';
        console.log('Compilation error (status 6)');
      } else if (statusId >= 7 && statusId <= 12) {
        error = `Runtime Error: ${executionResult.stderr || statusDescription || 'Unknown runtime error'}`;
        actualOutput = 'Runtime Error';
        console.log('Runtime error:', statusDescription);
      } else if (executionResult.stderr && executionResult.stderr.trim()) {
        error = `Runtime Error: ${executionResult.stderr}`;
        actualOutput = 'Runtime Error';
        console.log('Runtime error:', executionResult.stderr);
      } else {
        actualOutput = (executionResult.stdout || '').trim();
        console.log('Execution output:', actualOutput);
      }
      
      const expectedOutput = (testCase.expectedOutput || '').trim();
      console.log('Expected output:', expectedOutput);
      passed = actualOutput === expectedOutput && !error;
      console.log('Test passed:', passed);
      
      const results = [
        {
          testCaseId: testCase.id,
          input: testCase.input || '',
          expectedOutput: expectedOutput,
          actualOutput: actualOutput,
          passed,
          error: error,
          executionTime: executionResult.time || 0,
          memory: executionResult.memory || 0,
          statusDescription: statusDescription
        }
      ];
      
      console.log('Sending test results to client:', {
        results,
        totalTests: 1,
        passedTests: passed ? 1 : 0,
        language,
        testCaseId
      });
      
      return res.json({
        results,
        totalTests: 1,
        passedTests: passed ? 1 : 0,
        language,
        testCaseId
      });
      
    } catch (execError) {
      console.error('Execution error:', execError);
      return res.status(500).json({
        error: 'Failed to execute code',
        details: execError.message || 'Unknown execution error'
      });
    }
    
  } catch (err) {
    console.error('Unexpected error in runTest:', err);
    return res.status(500).json({
      error: 'Failed to run test',
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
      const studentKey = sub.studentId || sub.userId;
      if (!studentSubmissions[studentKey]) {
        studentSubmissions[studentKey] = {
          student: sub.user,
          submissions: [],
          solved: 0,
          attempted: 0,
          averageTime: 0,
          totalTime: 0,
        };
      }
      
      studentSubmissions[studentKey].submissions.push(sub);
      
      // Count unique test cases attempted
      const testCaseIds = new Set(studentSubmissions[studentKey].submissions.map(s => s.testcase.id));
      studentSubmissions[studentKey].attempted = testCaseIds.size;
      
      // Add to total time if solved
      if (sub.status === 'Solved') {
        studentSubmissions[studentKey].totalTime += sub.timeTaken || 0;
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

    // Define a default value for active time window
    const ACTIVE_TIME_WINDOW_MINUTES = parseInt(process.env.ACTIVE_TIME_WINDOW_MINUTES || '30', 10);
    
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