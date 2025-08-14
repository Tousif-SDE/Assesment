// Server/controllers/testCaseController.js
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import redis from '../redis/redisClient.js';

const prisma = new PrismaClient();
const isRedisConnected = () => redis.status === "ready";

const logHit = (msg) => console.log(`📦 [REDIS HIT] ${msg}`);
const logMiss = (msg) => console.log(`💾 [REDIS MISS] ${msg}`);

/**
 * Create a new test case
 */

export const createTestCase = async (req, res) => {
  try {
    const { roomId, input, expectedOutput, title, description } = req.body;
    if (!roomId || !input) return res.status(400).json({ message: 'Room ID and input are required' });

    // Verify that the room exists before creating a test case
    const roomExists = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!roomExists) {
      return res.status(404).json({ message: 'Room not found. Cannot create test case for non-existent room.' });
    }

    // Build data object conditionally to avoid referencing columns that might not yet exist
    const data = {
      id: uuidv4(),
      roomId,
      input,
      expectedOutput: expectedOutput || '',
      createdBy: req.user.id,
      title: title || 'Untitled Test Case',
    };
    if (typeof description !== 'undefined' && description !== '') {
      data.description = description; // will be ignored if column exists not yet migrated when omitted
    }

    const testCase = await prisma.testcase.create({ data });

    if (isRedisConnected()) {
      const testCaseKey = `testcase:${roomId}:${testCase.id}`;
      const roomKey = `testcases:${roomId}`;
      await redis.set(testCaseKey, JSON.stringify(testCase));
      const cachedList = JSON.parse(await redis.get(roomKey) || '[]');
      cachedList.push(testCase);
      await redis.set(roomKey, JSON.stringify(cachedList));
      console.log(`✅ Stored test case ${testCase.id} in Redis for room ${roomId}`);
    } else {
      console.warn('⚠ Redis not connected — skipping cache write.');
    }

    // Sync with SocketManager's in-memory room + Redis, and emit to students
    try {
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        let roomData = socketManager.rooms.get(roomId) || {
          id: roomId,
          students: [],
          teachers: [],
          testCases: [],
          submissions: [],
          createdAt: new Date(),
          lastActivity: new Date(),
          currentState: { code: '', input: '', output: '', language: 'javascript' },
          stats: { totalSubmissions: 0, solvedTestCases: 0, activeStudentsCount: 0 }
        };
        roomData.testCases = [...(roomData.testCases || []), testCase];
        roomData.lastActivity = new Date();
        socketManager.rooms.set(roomId, roomData);
        await socketManager.persistRoomData(roomId, roomData);

        if (socketManager.io) {
          socketManager.io.to(roomId).emit('test-case-created', {
            testCase,
            totalTestCases: roomData.testCases.length,
            timestamp: Date.now()
          });
        }
      }
    } catch (e) {
      console.warn('Socket/Redis sync failed for test-case-created:', e.message);
    }

    res.status(201).json(testCase);
  } catch (error) {
    console.error('Error creating test case:', error);
    res.status(500).json({ message: 'Failed to create test case', error: error.message || error });
  }
};

/**
 * Get all test cases for a room
 */
export const getTestCasesByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    if (!roomId) return res.status(400).json({ message: 'Room ID is required' });

    if (isRedisConnected()) {
      const cached = await redis.get(`testcases:${roomId}`);
      if (cached) {
        logHit(`Room ${roomId} — served ${JSON.parse(cached).length} cases from Redis`);
        return res.json(JSON.parse(cached));
      }
      logMiss(`Room ${roomId} — not found in Redis`);
    } else {
      console.warn('⚠ Redis not connected — fetching from DB only.');
    }

    const testCases = await prisma.testcase.findMany({ where: { roomId } });

    if (isRedisConnected()) {
      await redis.set(`testcases:${roomId}`, JSON.stringify(testCases));
      console.log(`✅ Stored ${testCases.length} test cases in Redis for room ${roomId}`);
    }

    res.json(testCases);
  } catch (error) {
    console.error('Error getting test cases:', error);
    res.status(500).json({ message: 'Failed to get test cases', error: error.message });
  }
};

/**
 * Publish a test case
 */
export const publishTestCase = async (req, res) => {
  try {
    const { testCaseId } = req.params;
    const { expectedOutput, description, title } = req.body;
    if (!testCaseId) return res.status(400).json({ message: 'Test case ID is required' });

    const testCase = await prisma.testcase.update({
      where: { id: testCaseId },
      data: { 
        expectedOutput: expectedOutput ?? '',
        description: description ?? undefined,
        title: title ?? undefined
      }
    });

    const room = await prisma.room.findUnique({ where: { id: testCase.roomId } });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (isRedisConnected()) {
      const testCaseKey = `testcase:${testCase.roomId}:${testCase.id}`;
      const roomKey = `testcases:${testCase.roomId}`;

      await redis.set(testCaseKey, JSON.stringify(testCase));
      const cachedList = JSON.parse(await redis.get(roomKey) || '[]');
      const idx = cachedList.findIndex(tc => tc.id === testCase.id);
      if (idx !== -1) cachedList[idx] = testCase; else cachedList.push(testCase);
      await redis.set(roomKey, JSON.stringify(cachedList));

      console.log(`✅ Updated test case ${testCase.id} in Redis for room ${testCase.roomId}`);
    } else {
      console.warn('⚠ Redis not connected — skipping cache update.');
    }

    req.app.get('socketManager').io.to(testCase.roomId).emit('test-case-published', {
      testCase,
      timestamp: Date.now()
    });

    res.json({ message: 'Test case published successfully', testCase });
  } catch (error) {
    console.error('Error publishing test case:', error);
    res.status(500).json({ message: 'Failed to publish test case', error: error.message });
  }
};
