import type { Redis } from 'ioredis';
import crypto from 'node:crypto';
import logger from '../logger.js';

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export interface RedisLock {
  key: string;
  token: string;
}

export const acquireLock = async (
  redis: Redis,
  key: string,
  ttlMs: number
): Promise<RedisLock | null> => {
  const token = crypto.randomUUID();
  try {
    const result = await redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      return { key, token };
    }
    return null;
  } catch (error) {
    logger.error({ error, key }, '[Ingestion] Failed to acquire Redis lock');
    return null;
  }
};

export const releaseLock = async (redis: Redis, lock: RedisLock | null): Promise<void> => {
  if (!lock) {
    return;
  }

  try {
    await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
  } catch (error) {
    logger.error({ error, key: lock.key }, '[Ingestion] Failed to release Redis lock');
  }
};
