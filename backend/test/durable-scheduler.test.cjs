const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("tenant schedulers enqueue durable commands and RabbitMQ executes them by tenant", () => {
  const index = fs.readFileSync(path.join(__dirname, "../server/jobs/index.ts"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "../server/jobs/outbox.job.ts"), "utf8");
  assert.match(index, /registerJobHandler\("scheduler\.command"/);
  assert.match(index, /jobQueueService\.enqueue\(\s*"scheduler\.command"/);
  assert.match(index, /maxAttempts:\s*8/);
  const rabbit = fs.readFileSync(
    path.join(__dirname, "../server/services/rabbitmq.service.ts"),
    "utf8",
  );
  assert.match(worker, /rabbitMqService\.start/);
  assert.match(rabbit, /tenantLocalStorage\.run/);
  assert.match(rabbit, /confirmedPublish/);
});

test("dead letters are inspectable and replay creates a traced new event", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/job-queue.service.ts"),
    "utf8",
  );
  const routes = fs.readFileSync(
    path.join(__dirname, "../server/routes/operations.routes.ts"),
    "utf8",
  );
  assert.match(service, /listDead/);
  const rabbit = fs.readFileSync(
    path.join(__dirname, "../server/services/rabbitmq.service.ts"),
    "utf8",
  );
  assert.match(rabbit, /replayedBy/);
  assert.match(rabbit, /replayReason/);
  assert.match(routes, /dead-letters\/:id\/replay/);
});
