// Server/routes/testCaseRoutes.js
import express from 'express';
import { createTestCase, getTestCasesByRoom, publishTestCase } from '../controllers/testCaseController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route   POST /api/testcases
 * @desc    Create a new test case
 * @access  Protected (Teacher)
 * @body    { roomId, input, expectedOutput }
 */
router.post('/', protect, createTestCase);

/**
 * @route   GET /api/testcases/room/:roomId
 * @desc    Get all test cases for a specific room
 * @access  Protected
 */
router.get('/room/:roomId', protect, getTestCasesByRoom);

/**
 * @route   POST /api/testcases/publish/:testCaseId
 * @desc    Publish a test case so students can see/attempt it
 * @access  Protected (Teacher)
 */
router.post('/publish/:testCaseId', protect, publishTestCase);

export default router;
