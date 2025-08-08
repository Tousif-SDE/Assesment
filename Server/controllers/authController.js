// Server/controllers/authController.js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/prismaClient.js'; // Fixed path
import redis from '../redis/redisClient.js';

// Add logout function to handle token invalidation

const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });
};

export const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  // Validate role (case-sensitive)
  if (role !== 'TEACHER' && role !== 'STUDENT') {
    return res.status(400).json({ message: 'Invalid role. Must be TEACHER or STUDENT.' });
  }

  const userExists = await prisma.user.findUnique({ where: { email } });
  if (userExists) return res.status(400).json({ message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role },
  });

  res.status(201).json({ message: 'User registered successfully' });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user);

    // Try to store token in Redis, but don't block login if Redis is down
    try {
      await redis.set(user.id, token);
      console.log('Token stored in Redis for user:', user.id);
    } catch (redisErr) {
      console.error('Failed to store token in Redis:', redisErr);
      // Continue with login process even if Redis fails
    }

    res.json({ token, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const logout = async (req, res) => {
  try {
    // Get user ID from the request (set by verifyToken middleware)
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in request' });
    }

    // Remove token from Redis
    try {
      await redis.del(userId);
      console.log('Token removed from Redis for user:', userId);
    } catch (redisErr) {
      console.error('Failed to remove token from Redis:', redisErr);
      // Continue with logout process even if Redis fails
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};