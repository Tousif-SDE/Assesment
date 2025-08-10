import prisma from '../prisma/prismaClient.js';

// Define the active time window in minutes - configurable via environment variable
const ACTIVE_TIME_WINDOW_MINUTES = parseInt(process.env.ACTIVE_TIME_WINDOW_MINUTES || '30', 10);

/**
 * Get teacher dashboard data
 * @route GET /api/teacher/dashboard
 * @access Private (Teacher only)
 */
export const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Verify user is a teacher
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({ error: 'Not authorized. Teachers only.' });
    }

    // Get all rooms created by this teacher
    const rooms = await prisma.room.findMany({
      where: { teacherId },
      select: { id: true }
    });

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'No rooms found for this teacher' });
    }

    // Get room IDs
    const roomIds = rooms.map(room => room.id);

    // Calculate the timestamp for active students (last X minutes)
    const activeTimeWindow = new Date();
    activeTimeWindow.setMinutes(activeTimeWindow.getMinutes() - ACTIVE_TIME_WINDOW_MINUTES);

    // Get all submissions across all rooms
    const submissions = await prisma.submission.findMany({
      where: {
        testcase: {
          roomId: { in: roomIds }
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

    // Get all test cases for these rooms
    const testCases = await prisma.testcase.findMany({
      where: { roomId: { in: roomIds } },
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

    // Prepare and send the dashboard data
    const dashboardData = {
      totalActive,
      totalAttempted,
      totalSolved,
      solvedTestCases,
      submissions: formattedSubmissions,
      activeTimeWindowMinutes: ACTIVE_TIME_WINDOW_MINUTES
    };

    res.json(dashboardData);
  } catch (err) {
    console.error('Teacher dashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard data', details: err.message });
  }
};