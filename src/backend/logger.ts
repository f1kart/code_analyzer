import pino from 'pino';

// Backend logger used across the Node services. This implementation is
// deliberately safe to import in browser bundles: it avoids Node-only
// modules like `path` and `fs`, and logs to stdout/stderr instead. In a
// production deployment, stdout can be captured by the process manager or
// log shipping stack (e.g. systemd, Docker, or a logging sidecar).

type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv: RuntimeEnv = typeof process !== 'undefined' && process?.env ? (process.env as RuntimeEnv) : {};
const nodeEnv = runtimeEnv.NODE_ENV;
const level = runtimeEnv.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug');
const environment = nodeEnv || 'production';

const logger = pino({
  level,
  base: {
    service: 'gemini-ide-backend',
    environment,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'config.apiKey',
      'config.redis.password',
      '*.headers.cookie',
      '*.body.password',
    ],
    censor: '[REDACTED]',
    remove: false,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Creates a child logger with additional context.
 *
 * Usage:
 * const childLogger = logger.child({ requestId: 'some-uuid' });
 * childLogger.info('This log will have the requestId');
 */
export default logger;
