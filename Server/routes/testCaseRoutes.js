// Server/routes/testCaseRoutes.js
import express from 'express';
import { createTestCase, getTestCasesByRoom } from '../controllers/testCaseController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/testcases --> body: { roomId, input, expectedOutput }
router.post('/', protect, createTestCase);

// GET /api/testcases/:roomId --> returns all test cases for a room
router.get('/:roomId', protect, getTestCasesByRoom);

export default router;
