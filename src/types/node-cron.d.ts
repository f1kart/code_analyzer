declare module 'node-cron' {
  export interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
    name?: string;
  }

  export interface ScheduledTask {
    start(): void;
    stop(): void;
    destroy(): void;
    getStatus(): 'scheduled' | 'running' | 'stopped';
  }

  export function schedule(
    expression: string,
    callback: () => void | Promise<void>,
    options?: ScheduleOptions
  ): ScheduledTask;

  interface NodeCronModule {
    schedule: typeof schedule;
  }

  const nodeCron: NodeCronModule;
  export default nodeCron;
}
