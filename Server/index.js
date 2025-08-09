import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { initializeSocket } from './socket.js'; // changed to named import
import redisClient from './redis/redisClient.js';

import authRoutes from './routes/authRoutes.js';
import codeRoutes from './routes/codeRoutes.js';
import testCaseRoutes from './routes/testCaseRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import roomRoutes from './routes/roomRoutes.js'; // main room routes

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Redis connection events
redisClient.on('connect', () => console.log('✅ Connected to Redis'));
redisClient.on('ready', () => console.log('✅ Redis is ready to use'));
redisClient.on('error', (err) => console.error('❌ Redis connection error:', err));
redisClient.on('reconnecting', () => console.log('🔄 Reconnecting to Redis...'));
redisClient.on('end', () => console.log('❌ Redis connection closed'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/room', roomRoutes); // Use singular form to match frontend
app.use('/api/code', codeRoutes);
app.use('/api/testcases', testCaseRoutes);
app.use('/api/submissions', submissionRoutes);

app.get('/', (req, res) => res.send('API is running...'));

// Initialize socket.io
initializeSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
