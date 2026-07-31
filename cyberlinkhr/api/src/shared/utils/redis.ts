import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis error:', err));

export async function connectRedis() {
  await redisClient.connect();
  console.log('Redis connected');
}

export async function blacklistToken(token: string, expiresInSeconds: number) {
  await redisClient.setEx(`blacklist:${token}`, expiresInSeconds, '1');
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const val = await redisClient.get(`blacklist:${token}`);
  return val !== null;
}

export async function setCache(key: string, value: string, ttlSeconds?: number) {
  if (ttlSeconds) {
    await redisClient.setEx(key, ttlSeconds, value);
  } else {
    await redisClient.set(key, value);
  }
}

export async function getCache(key: string): Promise<string | null> {
  return redisClient.get(key);
}

export async function deleteCache(key: string) {
  await redisClient.del(key);
}

export { redisClient };
