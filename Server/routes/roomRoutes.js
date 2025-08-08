import express from 'express';
import { createRoom, getMyRooms, joinRoom } from '../controllers/roomController.js';
import { protect, teacherOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get rooms created by the logged-in TEACHER
router.get('/myrooms', protect, getMyRooms);

// Create a new room
router.post("/create", protect, teacherOnly, createRoom);


// Join a room
router.post('/join', protect, joinRoom);

export default router;
