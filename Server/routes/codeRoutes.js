// Server/routes/codeRoutes.js
import express from 'express';
import { runCode } from '../controllers/codeController.js';
import { protect } from '../middleware/authMiddleware.js'; // ✅ FIXED

const router = express.Router();

router.post('/run', protect, runCode); // ✅ FIXED

export default router;
