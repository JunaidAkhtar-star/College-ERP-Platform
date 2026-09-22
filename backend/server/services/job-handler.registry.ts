export type JobPayload = Record<string, unknown>;
export interface IJobHandler {
  run: (payload: JobPayload) => Promise<void>;
  onDead?: (payload: JobPayload, error: string) => Promise<void>;
}

const handlers = new Map<string, IJobHandler>();

export function registerJobHandler(topic: string, handler: IJobHandler): void {
  if (handlers.has(topic)) throw new Error(`Job handler already registered: ${topic}`);
  handlers.set(topic, handler);
}

export function getJobHandler(topic: string): IJobHandler | undefined {
  return handlers.get(topic);
}
