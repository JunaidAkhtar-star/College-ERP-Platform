import { randomUUID } from "crypto";
import { OutboxEventModel } from "../models/outbox-event.model";
import { cryptoUtil } from "../utils/crypto.util";
import { rabbitMqService } from "./rabbitmq.service";
import type { JobPayload } from "./job-handler.registry";
import type { ClientSession } from "mongoose";

const workerId = `${process.env["HOSTNAME"] ?? "local"}:${process.pid}:${randomUUID()}`;

export const outboxService = {
  enqueue(
    topic: string,
    idempotencyKey: string,
    payload: JobPayload,
    tenant: { tenantId: string; databaseName: string },
    options: { availableAt?: Date; maxAttempts?: number; session?: ClientSession } = {},
  ) {
    return OutboxEventModel.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          topic,
          idempotencyKey,
          payloadCiphertext: cryptoUtil.encrypt(JSON.stringify(payload)),
          tenantId: tenant.tenantId,
          databaseName: tenant.databaseName,
          status: "pending",
          attempts: 0,
          maxAttempts: Math.min(20, Math.max(1, options.maxAttempts ?? 5)),
          availableAt: options.availableAt ?? new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
        session: options.session,
      },
    )
      .lean()
      .exec();
  },

  async publishDue(limit = 100) {
    let published = 0;
    let failed = 0;
    for (let index = 0; index < limit; index += 1) {
      const now = new Date();
      const event = await OutboxEventModel.findOneAndUpdate(
        {
          $or: [
            { status: "pending", availableAt: { $lte: now } },
            { status: "publishing", lockedAt: { $lte: new Date(now.getTime() - 60_000) } },
          ],
        },
        {
          $set: { status: "publishing", lockedAt: now, lockedBy: workerId },
          $inc: { attempts: 1 },
        },
        { returnDocument: "after", sort: { availableAt: 1 } },
      )
        .select("+payloadCiphertext")
        .lean()
        .exec();
      if (!event) break;
      try {
        const payload = JSON.parse(cryptoUtil.decrypt(event.payloadCiphertext)) as JobPayload;
        await rabbitMqService.enqueue({
          topic: event.topic,
          idempotencyKey: event.idempotencyKey,
          payload,
          tenantId: event.tenantId,
          databaseName: event.databaseName,
          maxAttempts: event.maxAttempts,
        });
        await OutboxEventModel.updateOne(
          { _id: event._id, lockedBy: workerId },
          {
            $set: { status: "published", publishedAt: new Date() },
            $unset: { lockedAt: 1, lockedBy: 1, lastError: 1 },
          },
        ).exec();
        published += 1;
      } catch (error) {
        const lastError = error instanceof Error ? error.message.slice(0, 1000) : "Publish failed";
        await OutboxEventModel.updateOne(
          { _id: event._id, lockedBy: workerId },
          {
            $set: {
              status: "pending",
              availableAt: new Date(Date.now() + Math.min(60_000, 2 ** event.attempts * 1_000)),
              lastError,
            },
            $unset: { lockedAt: 1, lockedBy: 1 },
          },
        ).exec();
        failed += 1;
        break;
      }
    }
    return { published, failed };
  },

  async summary() {
    const rows = await OutboxEventModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  },
};
