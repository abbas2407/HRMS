import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../utils/redis';

function makeStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
  });
}

function lazyRateLimit(options: Parameters<typeof rateLimit>[0] & { storePrefix: string }): RequestHandler {
  let limiter: RequestHandler | null = null;
  const { storePrefix, ...rest } = options;
  return (req, res, next) => {
    if (!limiter) {
      limiter = rateLimit({ ...rest, store: makeStore(storePrefix) });
    }
    return limiter(req, res, next);
  };
}

export const generalRateLimit = lazyRateLimit({
  storePrefix: 'rl:general:',
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = lazyRateLimit({
  storePrefix: 'rl:auth:',
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
