// Server/middleware/verifyToken.js
import jwt from 'jsonwebtoken';
import redis from '../redis/redisClient.js';

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(403).json({ message: 'A token is required for authentication' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token missing' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        try {
            // Check if Redis is connected and token is valid
            const redisToken = await redis.get(decoded.id);
            
            // If Redis is connected but token doesn't match
            if (redisToken && token !== redisToken) {
                return res.status(403).json({ message: 'Session expired' });
            }
            
            // Get user session data from Redis
            const sessionData = await redis.get(`session:${decoded.id}`);
            
            if (sessionData) {
                // Parse session data and attach to request
                req.session = JSON.parse(sessionData);
            }
            
            // If Redis is connected and token matches or Redis doesn't have the token yet
            req.user = decoded;
            next();
        } catch (redisErr) {
            // If Redis is down, still allow the request to proceed
            console.error('Redis error in verifyToken:', redisErr);
            req.user = decoded;
            next();
        }
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

export default verifyToken;