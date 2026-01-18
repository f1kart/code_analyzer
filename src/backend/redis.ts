import Redis, { RedisOptions } from 'ioredis';
import config from './config';
import logger from './logger';

class RedisClient {
  private static instance: Redis;

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      const options: RedisOptions = {
        keyPrefix: config.redis.keyPrefix,
        lazyConnect: true,
        enableAutoPipelining: true,
        maxRetriesPerRequest: null,
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            logger.warn({ err }, '[Redis] Reconnecting on READONLY error');
            return true;
          }
          return false;
        },
        connectionName: config.redis.connectionName,
      };

      if (config.redis.url) {
        RedisClient.instance = new Redis(config.redis.url, options);
      } else {
        RedisClient.instance = new Redis({
          ...options,
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          tls: config.redis.tls ? {} : undefined,
        });
      }

      RedisClient.instance.on('connect', () => logger.info('[Redis] Connected to cache'));
      RedisClient.instance.on('error', (error) => logger.error({ error }, '[Redis] Connection error'));
      RedisClient.instance.on('reconnecting', () => logger.warn('[Redis] Reconnecting'));
    }

    return RedisClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      // This is not strictly necessary as ioredis will not reuse the instance
      // but it's good practice to nullify it.
      // @ts-ignore
      RedisClient.instance = null;
    }
  }
}

export const redis = RedisClient.getInstance();

export const disconnectRedis = RedisClient.disconnect;
