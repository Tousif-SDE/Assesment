import express from 'express';
import { createRoom, getMyRooms, joinRoom, deleteRoom } from '../controllers/roomController.js';
import { protect, teacherOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get rooms created by the logged-in TEACHER
router.get('/myrooms', protect, getMyRooms);

// Create a new room
router.post("/create", protect, teacherOnly, createRoom);


// Join a room
router.post('/join', protect, joinRoom);

// Delete a room (teacher only)
router.delete('/:roomId', protect, teacherOnly, deleteRoom);

export default router;
