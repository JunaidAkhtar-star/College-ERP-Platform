const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("meeting evidence requires independent minutes approval and recording consent", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/meeting.service.ts"),
    "utf8",
  );
  const recording = fs.readFileSync(
    path.join(__dirname, "../server/services/meeting-recording.service.ts"),
    "utf8",
  );
  assert.match(service, /Minutes submitter cannot approve their own minutes/);
  assert.match(service, /minutesStatus:\s*decision/);
  assert.match(recording, /without attendee consent/);
});

test("meeting visibility and management use only the active role", () => {
  const controller = fs.readFileSync(
    path.join(__dirname, "../server/controllers/meeting.controller.ts"),
    "utf8",
  );
  const routes = fs.readFileSync(
    path.join(__dirname, "../server/routes/meeting.routes.ts"),
    "utf8",
  );
  assert.match(controller, /const roles = \[String\(req\.activeRole\)\]/);
  assert.doesNotMatch(controller, /req\.user!\.roles as string\[\]/);
  assert.match(controller, /function canManageMeeting/);
  assert.match(routes, /const canEdit = requirePermission\(Module\.MEETING, PermissionAction\.EDIT\)/);
  assert.match(routes, /query\("status"\)\.optional\(\)\.isIn/);
});

test("meetings can be completed only by submitting governed minutes", () => {
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/meeting.service.ts"),
    "utf8",
  );
  const validation = fs.readFileSync(
    path.join(__dirname, "../server/validations/modules.validation.ts"),
    "utf8",
  );
  assert.match(service, /completed: \[\] as const/);
  assert.match(validation, /\.isIn\(\["ongoing", "cancelled"\]\)/);
  assert.match(service, /minutesStatus: "pending_approval"/);
});
