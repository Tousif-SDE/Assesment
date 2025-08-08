// server/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import prisma from '../prisma/prismaClient.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const token = tokenMatch[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('JWT verify failed:', err);
      return res.status(401).json({ message: 'Not authorized, token invalid' });
    }

    if (!decoded || !decoded.id) {
      console.error('Decoded token payload is invalid:', decoded);
      return res.status(401).json({ message: 'Not authorized, token payload invalid' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      console.error(`User not found for ID from token: ${decoded.id}`);
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    return next();
  } catch (err) {
    console.error('Protect middleware error:', err);
    return res.status(500).json({ message: 'Server error in auth', error: err.message });
  }
};

export const teacherOnly = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (String(req.user.role).toUpperCase() !== 'TEACHER') {
      return res.status(403).json({ message: 'Access denied. Teachers only.' });
    }
    return next();
  } catch (err) {
    console.error('teacherOnly middleware error:', err);
    return res.status(500).json({ message: 'Server error in auth', error: err.message });
  }
};
