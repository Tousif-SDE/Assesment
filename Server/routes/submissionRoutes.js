// server/routes/submissionRoutes.js
import express from 'express';
import { createSubmission, getSubmissionsByStudent, getSubmissionsByRoom } from '../controllers/submissionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a submission
router.post('/', protect, createSubmission);

// Get submissions for the logged-in student (dashboard API)
router.get('/student', protect, getSubmissionsByStudent);

// Get all submissions for a room (teacher statistics)
router.get('/room/:roomId', protect, getSubmissionsByRoom);

export default router;