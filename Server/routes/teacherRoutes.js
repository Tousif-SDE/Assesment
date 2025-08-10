// server/routes/teacherRoutes.js
import express from 'express';
import { getTeacherDashboard } from '../controllers/teacherController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get teacher dashboard data
router.get('/dashboard', protect, getTeacherDashboard);

export default router;