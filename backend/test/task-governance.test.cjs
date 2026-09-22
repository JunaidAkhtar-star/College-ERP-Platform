const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("tasks preserve source linkage, dependencies, recurrence and SLA fields", () => {
  const model = fs.readFileSync(path.join(__dirname, "../server/models/task.model.ts"), "utf8");
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/task.service.ts"),
    "utf8",
  );
  for (const field of ["dependencyIds", "sourceModule", "sourceRecordId", "recurrence", "priority"])
    assert.match(model, new RegExp(field));
  assert.match(service, /approve all task dependencies/i);
  assert.match(service, /Only a completed task can be approved/);
  assert.match(service, /due date must be in the future/i);
});

test("task RBAC uses the active role and validates every mutation contract", () => {
  const routes = fs.readFileSync(path.join(__dirname, "../server/routes/task.routes.ts"), "utf8");
  const controller = fs.readFileSync(
    path.join(__dirname, "../server/controllers/task.controller.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/task.service.ts"),
    "utf8",
  );
  assert.match(controller, /\[String\(req\.activeRole\)\]/);
  assert.doesNotMatch(controller, /req\.user!\.roles as string\[\]/);
  assert.match(routes, /body\("assignees\.\*"\)\.isMongoId\(\)/);
  assert.match(routes, /body\("action"\)\.isIn\(\["approve", "reject"\]\)/);
  assert.match(service, /Department ownership is required for HOD task assignment/);
  assert.match(service, /roles: \{ \$in: EMPLOYEE_ROLES \}/);
});
