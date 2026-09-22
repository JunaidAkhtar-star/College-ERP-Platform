import createError from "http-errors";
import { configs } from "../configs";
import { tenantLocalStorage } from "../configs/connectionManager";
import {
  registerJobHandler as registerHandler,
  type IJobHandler,
  type JobPayload,
} from "./job-handler.registry";
import { rabbitMqService } from "./rabbitmq.service";
import { outboxService } from "./outbox.service";
import type { ClientSession } from "mongoose";

export function registerJobHandler(topic: string, handler: IJobHandler): void {
  registerHandler(topic, handler);
}

export const jobQueueService = {
  async enqueue(
    topic: string,
    idempotencyKey: string,
    payload: JobPayload,
    options: { availableAt?: Date; maxAttempts?: number; session?: ClientSession } = {},
  ) {
    if (!configs.RABBITMQ_URL) {
      throw createError(503, "RabbitMQ is required for background job delivery");
    }
    const tenant = tenantLocalStorage.getStore();
    if (!tenant?.tenantId || !tenant.tenantDb?.name) {
      throw createError(503, "Tenant context is required to publish a background job");
    }
    return outboxService.enqueue(
      topic,
      idempotencyKey,
      payload,
      { tenantId: tenant.tenantId, databaseName: tenant.tenantDb.name },
      options,
    );
  },

  summary: async () => ({
    broker: await rabbitMqService.summary(),
    outbox: await outboxService.summary(),
  }),
  listDead: () => rabbitMqService.listDead(),
  replay: async (id: string, actorId: string, reason: string) => {
    if (reason.trim().length < 10) throw createError(400, "A meaningful replay reason is required");
    const replayed = await rabbitMqService.replay(id, actorId, reason.trim());
    if (!replayed) throw createError(404, "Dead-letter message not found");
    return replayed;
  },
};
