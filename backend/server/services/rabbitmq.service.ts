import { Types } from "mongoose";
import { randomUUID } from "crypto";
import amqp, {
  type Channel,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
  type Message,
} from "amqplib";
import { configs } from "../configs";
import {
  getTenantConnection,
  tenantLocalStorage,
  waitForActiveConnection,
} from "../configs/connectionManager";
import { cryptoUtil } from "../utils/crypto.util";
import { logger } from "../utils/logger.util";
import { getJobHandler, type JobPayload } from "./job-handler.registry";
import { JobExecutionModel } from "../models/job-execution.model";
import { JobDeadLetterModel } from "../models/job-dead-letter.model";

const JOB_EXCHANGE = "erp.jobs";
const RETRY_EXCHANGE = "erp.jobs.retry";
const DEAD_EXCHANGE = "erp.jobs.dead";
const WORK_QUEUE = "erp.jobs.worker";
const DEAD_QUEUE = "erp.jobs.dead";
const JOB_ROUTE = "job";
const RETRIES = [
  { key: "5s", ttl: 5_000 },
  { key: "30s", ttl: 30_000 },
  { key: "2m", ttl: 120_000 },
  { key: "10m", ttl: 600_000 },
] as const;

interface IJobEnvelope {
  version: 1;
  id: string;
  topic: string;
  idempotencyKey: string;
  payloadCiphertext: string;
  tenantId: string;
  databaseName: string;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  availableAt?: string;
  lastError?: string;
  replayedBy?: string;
  replayReason?: string;
}

interface IEnqueueInput {
  topic: string;
  idempotencyKey: string;
  payload: JobPayload;
  tenantId: string;
  databaseName: string;
  availableAt?: Date;
  maxAttempts?: number;
}

let connection: ChannelModel | null = null;
let publisher: ConfirmChannel | null = null;
let consumer: Channel | null = null;
let connecting: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let stopping = false;

function parseEnvelope(message: Message): IJobEnvelope {
  const envelope = JSON.parse(message.content.toString("utf8")) as IJobEnvelope;
  if (
    envelope.version !== 1 ||
    !Types.ObjectId.isValid(envelope.id) ||
    !envelope.topic ||
    !envelope.tenantId ||
    !envelope.databaseName ||
    !envelope.payloadCiphertext
  )
    throw new Error("Invalid RabbitMQ job envelope");
  return envelope;
}

function retryTier(delayMs: number) {
  return RETRIES.find((tier) => delayMs <= tier.ttl) ?? RETRIES.at(-1)!;
}

async function declareTopology(channel: Channel | ConfirmChannel) {
  await channel.assertExchange(JOB_EXCHANGE, "direct", { durable: true });
  await channel.assertExchange(RETRY_EXCHANGE, "direct", { durable: true });
  await channel.assertExchange(DEAD_EXCHANGE, "fanout", { durable: true });
  await channel.assertQueue(DEAD_QUEUE, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });
  await channel.bindQueue(DEAD_QUEUE, DEAD_EXCHANGE, "");
  await channel.assertQueue(WORK_QUEUE, {
    durable: true,
    arguments: { "x-queue-type": "quorum", "x-dead-letter-exchange": DEAD_EXCHANGE },
  });
  await channel.bindQueue(WORK_QUEUE, JOB_EXCHANGE, JOB_ROUTE);
  for (const tier of RETRIES) {
    const queue = `erp.jobs.retry.${tier.key}`;
    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        "x-queue-type": "quorum",
        "x-message-ttl": tier.ttl,
        "x-dead-letter-exchange": JOB_EXCHANGE,
        "x-dead-letter-routing-key": JOB_ROUTE,
      },
    });
    await channel.bindQueue(queue, RETRY_EXCHANGE, tier.key);
  }
}

async function confirmedPublish(exchange: string, routingKey: string, envelope: IJobEnvelope) {
  const activePublisher = publisher;
  if (!activePublisher) throw new Error("RabbitMQ publisher is unavailable");
  const accepted = activePublisher.publish(
    exchange,
    routingKey,
    Buffer.from(JSON.stringify(envelope)),
    {
      persistent: true,
      contentType: "application/json",
      messageId: envelope.id,
      correlationId: envelope.idempotencyKey,
      timestamp: Date.now(),
      type: envelope.topic,
      headers: { attempt: envelope.attempt, tenantId: envelope.tenantId },
    },
  );
  if (!accepted) await new Promise<void>((resolve) => activePublisher.once("drain", resolve));
  await activePublisher.waitForConfirms();
}

async function handleMessage(channel: Channel, message: ConsumeMessage) {
  let envelope: IJobEnvelope;
  try {
    envelope = parseEnvelope(message);
  } catch (error) {
    logger.error("RabbitMQ rejected a malformed job message", error);
    channel.nack(message, false, false);
    return;
  }

  const remainingDelay = envelope.availableAt
    ? new Date(envelope.availableAt).getTime() - Date.now()
    : 0;
  if (remainingDelay > 0) {
    try {
      const tier = retryTier(remainingDelay);
      await confirmedPublish(RETRY_EXCHANGE, tier.key, envelope);
      channel.ack(message);
    } catch (publishError) {
      logger.error(`RabbitMQ delayed publish failed job=${envelope.id}`, publishError);
      channel.nack(message, false, true);
    }
    return;
  }

  let payload: JobPayload = {};
  const handler = getJobHandler(envelope.topic);
  let tenantDb: ReturnType<typeof getTenantConnection> | null = null;
  try {
    payload = JSON.parse(cryptoUtil.decrypt(envelope.payloadCiphertext)) as JobPayload;
    if (!handler) throw new Error(`No job handler registered for '${envelope.topic}'`);
    await waitForActiveConnection(10_000);
    tenantDb = getTenantConnection(envelope.tenantId, envelope.databaseName);
    const outcome = await tenantLocalStorage.run(
      { tenantId: envelope.tenantId, tenantDb },
      async () => {
        const staleAt = new Date(Date.now() - 15 * 60_000);
        const claimToken = randomUUID();
        let execution;
        try {
          execution = await JobExecutionModel.findOneAndUpdate(
            {
              topic: envelope.topic,
              idempotencyKey: envelope.idempotencyKey,
              $or: [{ status: "failed" }, { status: "processing", lockedAt: { $lte: staleAt } }],
            },
            {
              $set: {
                messageId: envelope.id,
                claimToken,
                status: "processing",
                lockedAt: new Date(),
              },
              $unset: { lastError: 1, completedAt: 1 },
              $setOnInsert: {
                topic: envelope.topic,
                idempotencyKey: envelope.idempotencyKey,
              },
            },
            { upsert: true, returnDocument: "after" },
          ).lean();
        } catch (claimError) {
          if ((claimError as { code?: number }).code !== 11000) throw claimError;
          execution = await JobExecutionModel.findOne({
            topic: envelope.topic,
            idempotencyKey: envelope.idempotencyKey,
          }).lean();
        }
        if (execution?.status === "completed") return "duplicate" as const;
        if (!execution || execution.claimToken !== claimToken) return "busy" as const;

        try {
          await handler.run(payload);
          await JobExecutionModel.updateOne(
            { _id: execution._id, claimToken, status: "processing" },
            { $set: { status: "completed", completedAt: new Date() } },
          ).exec();
          return "completed" as const;
        } catch (runError) {
          const runMessage =
            runError instanceof Error ? runError.message.slice(0, 1000) : "Job handler failed";
          await JobExecutionModel.updateOne(
            { _id: execution._id, claimToken },
            { $set: { status: "failed", lastError: runMessage } },
          ).exec();
          throw runError;
        }
      },
    );
    if (outcome === "busy") {
      channel.nack(message, false, true);
      return;
    }
    channel.ack(message);
  } catch (error) {
    const lastError = error instanceof Error ? error.message.slice(0, 1000) : "Job handler failed";
    if (envelope.attempt >= envelope.maxAttempts) {
      try {
        if (handler?.onDead) {
          tenantDb ??= getTenantConnection(envelope.tenantId, envelope.databaseName);
          await tenantLocalStorage.run({ tenantId: envelope.tenantId, tenantDb }, () =>
            handler.onDead!(payload, lastError),
          );
        }
      } catch (deadError) {
        logger.error(`RabbitMQ dead-letter callback failed job=${envelope.id}`, deadError);
      }
      try {
        tenantDb ??= getTenantConnection(envelope.tenantId, envelope.databaseName);
        await tenantLocalStorage.run({ tenantId: envelope.tenantId, tenantDb }, () =>
          JobDeadLetterModel.updateOne(
            { messageId: envelope.id },
            {
              $setOnInsert: {
                messageId: envelope.id,
                topic: envelope.topic,
                idempotencyKey: envelope.idempotencyKey,
                payloadCiphertext: envelope.payloadCiphertext,
                tenantId: envelope.tenantId,
                databaseName: envelope.databaseName,
                attempts: envelope.attempt,
                maxAttempts: envelope.maxAttempts,
                originalCreatedAt: new Date(envelope.createdAt),
              },
              $set: { lastError },
            },
            { upsert: true },
          ).exec(),
        );
        await confirmedPublish(DEAD_EXCHANGE, "", { ...envelope, lastError });
        channel.ack(message);
      } catch (deadPublishError) {
        logger.error(`RabbitMQ dead-letter publish failed job=${envelope.id}`, deadPublishError);
        channel.nack(message, false, true);
      }
      return;
    }
    try {
      const delay = Math.min(600_000, 2 ** envelope.attempt * 5_000);
      const tier = retryTier(delay);
      await confirmedPublish(RETRY_EXCHANGE, tier.key, {
        ...envelope,
        attempt: envelope.attempt + 1,
        lastError,
      });
      channel.ack(message);
    } catch (publishError) {
      logger.error(`RabbitMQ retry publish failed job=${envelope.id}`, publishError);
      channel.nack(message, false, true);
    }
  }
}

function scheduleReconnect() {
  if (stopping || !configs.RABBITMQ_URL || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void rabbitMqService.start();
  }, 5_000);
  reconnectTimer.unref();
}

export const rabbitMqService = {
  enabled: () => Boolean(configs.RABBITMQ_URL),
  connected: () => Boolean(connection && publisher && consumer),

  async start() {
    if (!configs.RABBITMQ_URL || connection) return;
    stopping = false;
    if (connecting) return connecting;
    connecting = (async () => {
      let nextConnection: ChannelModel | null = null;
      try {
        nextConnection = await amqp.connect(configs.RABBITMQ_URL);
        const nextPublisher = await nextConnection.createConfirmChannel();
        const nextConsumer = await nextConnection.createChannel();
        await Promise.all([declareTopology(nextPublisher), declareTopology(nextConsumer)]);
        await nextConsumer.prefetch(configs.RABBITMQ_PREFETCH);
        await nextConsumer.consume(
          WORK_QUEUE,
          (message) => message && void handleMessage(nextConsumer, message),
          { noAck: false },
        );
        nextConnection.on("error", (error) => logger.error("RabbitMQ connection error", error));
        nextConnection.on("close", () => {
          connection = null;
          publisher = null;
          consumer = null;
          if (!stopping) {
            logger.warn("RabbitMQ connection closed; reconnect scheduled");
            scheduleReconnect();
          }
        });
        connection = nextConnection;
        publisher = nextPublisher;
        consumer = nextConsumer;
        logger.info(`RabbitMQ connected queue=${WORK_QUEUE} prefetch=${configs.RABBITMQ_PREFETCH}`);
      } catch (error) {
        if (nextConnection && nextConnection !== connection) {
          try {
            await nextConnection.close();
          } catch {
            /* the failed connection may already be closed */
          }
        }
        logger.error("RabbitMQ startup failed", error);
        scheduleReconnect();
      } finally {
        connecting = null;
      }
    })();
    return connecting;
  },

  async enqueue(input: IEnqueueInput) {
    await this.start();
    if (!publisher) throw new Error("RabbitMQ is unavailable; job was not accepted");
    const envelope: IJobEnvelope = {
      version: 1,
      id: new Types.ObjectId().toString(),
      topic: input.topic,
      idempotencyKey: input.idempotencyKey,
      payloadCiphertext: cryptoUtil.encrypt(JSON.stringify(input.payload)),
      tenantId: input.tenantId,
      databaseName: input.databaseName,
      attempt: 1,
      maxAttempts: Math.min(20, Math.max(1, input.maxAttempts ?? 5)),
      createdAt: new Date().toISOString(),
      availableAt: input.availableAt?.toISOString(),
    };
    const delay = Math.max(0, (input.availableAt?.getTime() ?? Date.now()) - Date.now());
    if (delay > 0) {
      const tier = retryTier(delay);
      await confirmedPublish(RETRY_EXCHANGE, tier.key, envelope);
    } else await confirmedPublish(JOB_EXCHANGE, JOB_ROUTE, envelope);
    return {
      _id: envelope.id,
      topic: envelope.topic,
      idempotencyKey: envelope.idempotencyKey,
      status: "queued",
    };
  },

  async summary() {
    if (!consumer) throw new Error("RabbitMQ is unavailable");
    const [work, dead, ...retry] = await Promise.all([
      consumer.checkQueue(WORK_QUEUE),
      consumer.checkQueue(DEAD_QUEUE),
      ...RETRIES.map((tier) => consumer!.checkQueue(`erp.jobs.retry.${tier.key}`)),
    ]);
    return {
      queued: { count: work.messageCount, consumers: work.consumerCount },
      retrying: { count: retry.reduce((sum, queue) => sum + queue.messageCount, 0) },
      dead: { count: dead.messageCount },
    };
  },

  async listDead(limit = 100) {
    return JobDeadLetterModel.find({ replayedAt: { $exists: false } })
      .select("-payloadCiphertext")
      .sort({ createdAt: -1 })
      .limit(Math.min(500, Math.max(1, limit)))
      .lean()
      .then((rows) =>
        rows.map((row) => ({
          _id: row.messageId,
          topic: row.topic,
          idempotencyKey: row.idempotencyKey,
          status: "dead",
          attempts: row.attempts,
          maxAttempts: row.maxAttempts,
          lastError: row.lastError,
          createdAt: row.originalCreatedAt,
        })),
      );
  },

  async replay(id: string, actorId: string, reason: string) {
    if (!publisher) throw new Error("RabbitMQ is unavailable");
    const target = await JobDeadLetterModel.findOneAndUpdate(
      {
        messageId: id,
        replayedAt: { $exists: false },
        $or: [
          { replayingAt: { $exists: false } },
          { replayingAt: { $lte: new Date(Date.now() - 60_000) } },
        ],
      },
      { $set: { replayingAt: new Date() } },
      { returnDocument: "after" },
    )
      .select("+payloadCiphertext")
      .lean();
    if (!target) return null;
    const replayed: IJobEnvelope = {
      version: 1,
      id: new Types.ObjectId().toString(),
      topic: target.topic,
      idempotencyKey: `replay:${target.messageId}`,
      payloadCiphertext: target.payloadCiphertext,
      tenantId: target.tenantId,
      databaseName: target.databaseName,
      attempt: 1,
      maxAttempts: target.maxAttempts,
      createdAt: new Date().toISOString(),
      replayedBy: actorId,
      replayReason: reason,
    };
    try {
      await confirmedPublish(JOB_EXCHANGE, JOB_ROUTE, replayed);
      await JobDeadLetterModel.updateOne(
        { _id: target._id, replayedAt: { $exists: false } },
        {
          $set: {
            replayedAt: new Date(),
            replayedBy: actorId,
            replayReason: reason,
            replayMessageId: replayed.id,
          },
          $unset: { replayingAt: 1 },
        },
      );
    } catch (error) {
      await JobDeadLetterModel.updateOne(
        { _id: target._id, replayedAt: { $exists: false } },
        { $unset: { replayingAt: 1 } },
      );
      throw error;
    }
    return {
      _id: replayed.id,
      idempotencyKey: replayed.idempotencyKey,
      status: "queued",
      replayedBy: actorId,
      replayReason: reason,
    };
  },

  async stop() {
    stopping = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    const active = connection;
    connection = null;
    publisher = null;
    consumer = null;
    if (active) await active.close();
  },
};
