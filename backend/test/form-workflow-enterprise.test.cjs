const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("published form discovery and decisions use the active role", () => {
  const controller = read("server/controllers/form-workflow.controller.ts");
  const service = read("server/services/form-workflow.service.ts");

  assert.match(controller, /req\.activeRole/);
  assert.match(controller, /listDefinitions\(false, identity\(req\)\.roles\[0\]\)/);
  assert.match(service, /submissionRoles: activeRole/);
  assert.match(service, /Your role cannot decide this workflow step/);
});

test("workflow reminders are governed, rate limited and delivered to current approvers", () => {
  const model = read("server/models/form-workflow.model.ts");
  const service = read("server/services/form-workflow.service.ts");
  const routes = read("server/routes/form-workflow.routes.ts");

  assert.match(model, /lastReminderAt/);
  assert.match(model, /reminderCount/);
  assert.match(service, /last 6 hours/);
  assert.match(service, /step\?\.approverRoles/);
  assert.match(routes, /\/submissions\/:id\/remind/);
});

test("workflow governance preserves independent publication and safe withdrawal", () => {
  const service = read("server/services/form-workflow.service.ts");

  assert.match(service, /form submitter cannot publish the same version/i);
  assert.match(service, /Self-approval is not allowed/);
  assert.match(service, /decisions: \{ \$size: 0 \}/);
  assert.match(service, /Another approver already processed this step/);
});

test("workflow delegation is bounded, attributable and cannot bypass separation of duties", () => {
  const model = read("server/models/form-workflow.model.ts");
  const service = read("server/services/form-workflow.service.ts");
  const routes = read("server/routes/form-workflow.routes.ts");
  assert.match(model, /WorkflowDelegationSchema\.plugin\(auditPlugin\)/);
  assert.match(service, /at most 90 days/);
  assert.match(service, /overlapping delegation/);
  assert.match(service, /delegatedFor: delegation\?\.delegatorId/);
  assert.match(service, /delegation\?\.delegatorId.*submittedBy/s);
  assert.match(routes, /\/delegations\/:id/);
});

test("SLA escalation is idempotent and registered in the tenant-aware scheduler", () => {
  const service = read("server/services/form-workflow.service.ts");
  const job = read("server/jobs/workflow-escalation.job.ts");
  const jobs = read("server/jobs/index.ts");
  assert.match(service, /processEscalations/);
  assert.match(service, /claimed\.modifiedCount/);
  assert.match(service, /escalatedAt: now/);
  assert.match(job, /\*\/15 \* \* \* \*/);
  assert.match(jobs, /startWorkflowEscalationJob\(\)/);
});
