const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("RabbitMQ declares durable work, retry and dead-letter topology", () => {
  const source = read("server/services/rabbitmq.service.ts");
  assert.match(source, /assertExchange\(JOB_EXCHANGE, "direct", \{ durable: true \}\)/);
  assert.match(source, /assertExchange\(RETRY_EXCHANGE, "direct", \{ durable: true \}\)/);
  assert.match(source, /"x-dead-letter-exchange": DEAD_EXCHANGE/);
  assert.match(source, /assertQueue\(WORK_QUEUE, \{[\s\S]*?durable: true/);
  assert.match(source, /prefetch\(configs\.RABBITMQ_PREFETCH\)/);
});

test("RabbitMQ uses confirmed persistent messages and manual acknowledgements", () => {
  const source = read("server/services/rabbitmq.service.ts");
  assert.match(source, /createConfirmChannel\(\)/);
  assert.match(source, /persistent: true/);
  assert.match(source, /waitForConfirms\(\)/);
  assert.match(source, /\{ noAck: false \}/);
  assert.match(source, /channel\.nack\(message, false, false\)/);
});

test("RabbitMQ envelopes encrypt payloads and preserve tenant routing", () => {
  const source = read("server/services/rabbitmq.service.ts");
  assert.match(source, /tenantLocalStorage\.run/);
  assert.match(source, /cryptoUtil\.encrypt\(JSON\.stringify\(input\.payload\)\)/);
  assert.match(source, /tenantId: input\.tenantId/);
});

test("job delivery uses MongoDB outbox before confirmed RabbitMQ publication", () => {
  const service = read("server/services/job-queue.service.ts");
  const outbox = read("server/services/outbox.service.ts");
  const runtime = read("server/jobs/outbox.job.ts");
  assert.match(service, /outboxService\.enqueue/);
  assert.match(outbox, /rabbitMqService\.enqueue/);
  assert.match(outbox, /status: "published"/);
  assert.match(runtime, /outboxService\.publishDue/);
});

test("consumers persist idempotency receipts and replay uses a new identity", () => {
  const source = read("server/services/rabbitmq.service.ts");
  assert.match(source, /JobExecutionModel\.findOneAndUpdate/);
  assert.match(source, /idempotencyKey: `replay:/);
  assert.match(source, /id: new Types\.ObjectId\(\)\.toString\(\)/);
  assert.match(source, /if \(!stopping\)/);
});

test("tenant cron callbacks enqueue durable scheduler commands", () => {
  const source = read("server/jobs/index.ts");
  assert.match(source, /jobQueueService\.enqueue\(\s*"scheduler\.command"/);
  assert.match(source, /scheduler:\$\{tenant\.tenantId\}/);
  assert.doesNotMatch(source, /async \(\) => \{\s*await task\(context\);\s*\}/);
});
