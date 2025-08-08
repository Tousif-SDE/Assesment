// Server/routes/submissionRoutes.js
import express from 'express';
import { createSubmission, getSubmissionsByStudent } from '../controllers/submissionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createSubmission);
router.get('/student', protect, getSubmissionsByStudent); // <- this is your new dashboard API

export default router;
