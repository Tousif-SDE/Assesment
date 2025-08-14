import express from 'express';
import { createSubmission, getSubmissionsByStudent, getSubmissionsByRoom, runTest } from '../controllers/submissionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a submission
router.post('/', protect, createSubmission);

// Run code against test cases without creating a submission
router.post('/run-test', protect, runTest);

// Get submissions for the logged-in student (dashboard API)
router.get('/student', protect, getSubmissionsByStudent);

// Get all submissions for a room (teacher statistics)
router.get('/room/:roomId', protect, getSubmissionsByRoom);


router.get("/student-with-name", protect, getSubmissionsByStudent);
export default router;
