import redis from "../redis/redisClient.js";

export async function getCache(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setCache(key, value, ttlSeconds = 300) {
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
}

export async function delCache(key) {
  await redis.del(key);
}
