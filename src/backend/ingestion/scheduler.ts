import cron from 'node-cron';
import type { Logger } from 'pino';
import type { SchedulerHandle } from './types.ts';

interface SchedulerOptions {
  expression?: string;
  runOnInit?: boolean;
  timezone?: string;
}

const DEFAULT_EXPRESSION = '*/30 * * * * *'; // every 30 seconds

export const createCronScheduler = (
  label: string,
  handler: () => Promise<void>,
  logger: Logger,
  options: SchedulerOptions = {}
): SchedulerHandle => {
  const expression = options.expression ?? DEFAULT_EXPRESSION;
  const task = cron.schedule(
    expression,
    async () => {
      try {
        await handler();
      } catch (error) {
        logger.error({ error, label }, '[IngestionScheduler] Handler execution failed');
      }
    },
    {
      scheduled: false,
      timezone: options.timezone,
    }
  );

  task.start();

  if (options.runOnInit) {
    handler().catch((error) => {
      logger.error({ error, label }, '[IngestionScheduler] Initial handler run failed');
    });
  }

  return {
    stop: async () => {
      task.stop();
    },
  } satisfies SchedulerHandle;
};

export default createCronScheduler;
