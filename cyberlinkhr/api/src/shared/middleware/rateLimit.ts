import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../utils/redis';

function makeStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
  });
}

export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:general:'),
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore('rl:auth:'),
});
