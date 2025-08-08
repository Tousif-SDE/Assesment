// Server/routes/authRoutes.js
import express from 'express';
import { login, register, logout } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register); // This should work
router.post('/login', login); // This should work
router.post('/logout', protect, logout); // New logout endpoint

export default router;