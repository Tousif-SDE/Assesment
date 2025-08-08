import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max delay of 10 seconds
      const delay = Math.min(Math.pow(2, retries) * 100, 10000);
      console.log(`Redis reconnecting in ${delay}ms...`);
      return delay;
    }
  }
});

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
  // Don't crash the app on connection error
});

// Connect to Redis in a way that doesn't block server startup
const connectRedis = async () => {
  try {
    await redis.connect();
    console.log('Redis client connected successfully');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    // Retry connection after 5 seconds
    setTimeout(connectRedis, 5000);
  }
};

// Start connection process
connectRedis();

export default redis;
