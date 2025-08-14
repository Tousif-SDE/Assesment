// redisClient.js
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Optional: handle error events
redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

await redisClient.connect();

console.log('✅ Connected to Redis');

export default redisClient;
