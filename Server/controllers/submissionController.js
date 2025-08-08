// Server/controllers/submissionController.js
import prisma from '../prisma/prismaClient.js';
import axios from 'axios';

// ✅ Create Submission
export const createSubmission = async (req, res) => {
  try {
    const { testCaseId, code, language } = req.body;
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

    const actualOutput = response.data.stdout?.trim();
    const expected = testCase.expectedOutput.trim();
    const status = actualOutput === expected ? 'Solved' : 'Not Solved';

    // Generate a UUID for the submission ID
    const { v4: uuidv4 } = await import('uuid');
    const submissionId = uuidv4();
    
    const submission = await prisma.submission.create({
      data: {
        id: submissionId,
        studentId,
        code,
        output: actualOutput || '',
        status,
        testcase: {
          connect: { id: testCaseId } // Connect to testcase using the correct field name
        }
      },
    });

    res.status(201).json({ submission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit code', details: err.message });
  }
};

// ✅ Get Submissions by Student (with student name)
export const getSubmissionsByStudent = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await prisma.submission.findMany({
      where: { studentId },
      include: {
        testcase: {
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            roomId: true,
            title: true, // Include the title field
          },
        },
        user: { // This should be 'user' to match the model relationship
           select: {
            name: true, // 👈 get student name here
          },
        },
      },
    });

    if (submissions.length === 0) {
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
        title: sub.testcase.title, // Include the title field
      }));

    res.json({
      totalActive,
      totalAttempted,
      totalSolved,
      solvedTestCases,
      submissions, // includes student name in each submission
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get submissions', details: err.message });
  }
};
