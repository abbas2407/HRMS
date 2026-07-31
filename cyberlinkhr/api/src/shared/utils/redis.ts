import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let clientOptions: any = {};

if (redisUrl.startsWith('redis://:')) {
  // Extract password that may contain special characters like '@' or '#'
  const match = redisUrl.match(/^redis:\/\/:(.*)@([^@]+)$/);
  if (match) {
    const [, password, hostPort] = match;
    const [host, port] = hostPort.split(':');
    clientOptions = {
      socket: {
        host,
        port: port ? parseInt(port, 10) : 6379,
      },
      password,
    };
  } else {
    clientOptions = { url: redisUrl };
  }
} else {
  clientOptions = { url: redisUrl };
}

const redisClient = createClient(clientOptions);

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
