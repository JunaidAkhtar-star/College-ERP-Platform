const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("LMS providers inherit the hardened connector runtime", () => {
  const connector = read("server/services/external-connector.service.ts");
  const model = read("server/models/external-connector.model.ts");
  for (const provider of ["canvas_lms", "moodle_lms", "oneroster_1_2"]) {
    assert.match(connector, new RegExp(provider));
    assert.match(model, new RegExp(provider));
  }
  assert.match(connector, /safeConnectorUrl\(config\.endpoint\)/);
  assert.match(connector, /lms\.grade\.sync/);
});

test("LMS is a dedicated commercial entitlement with Coursera support", () => {
  const entitlements = read("server/constants/module-entitlements.ts");
  const catalog = read("server/scripts/data/platform-catalog.ts");
  const connector = read("server/services/external-connector.service.ts");
  assert.match(entitlements, /"lms-integration": "lms-integrations"/);
  assert.match(catalog, /slug: "lms-integrations"/);
  assert.match(catalog, /slug: "lms-integrations-addon"/);
  assert.match(catalog, /"lms-integrations",/);
  assert.match(connector, /label: "Coursera for Campus"/);
  assert.match(connector, /Coursera organization ID/);
});

test("sync uses stable mappings, idempotent runs, and bounded batches", () => {
  const model = read("server/models/lms-integration.model.ts");
  const service = read("server/services/lms-integration.service.ts");
  assert.match(model, /profileId: 1, entityType: 1, localId: 1.*unique: true/);
  assert.match(model, /idempotencyKey.*unique: true/);
  assert.match(service, /slice\(index, index \+ 500\)/);
  assert.match(service, /dv:\$\{entity\}/);
  assert.match(service, /bulkWrite/);
});

test("only governed academic records are exported", () => {
  const service = read("server/services/lms-integration.service.ts");
  assert.match(service, /AssignmentStatus\.PUBLISHED/);
  assert.match(service, /status: AssignmentStatus\.EVALUATED/);
  assert.match(service, /submission\.evaluatedAt/);
  assert.match(service, /published: true/);
});

test("imported grades are staged and reviewed through assignment grading history", () => {
  const model = read("server/models/lms-integration.model.ts");
  const service = read("server/services/lms-integration.service.ts");
  const controller = read("server/controllers/lms-integration.controller.ts");
  assert.match(model, /LmsImportedGradeModel/);
  assert.match(service, /status: "pending"/);
  assert.match(service, /assignmentService\.gradeSubmission/);
  assert.match(controller, /assertDepartmentAccess/);
});

test("scheduled synchronization and retry remain durable and auditable", () => {
  const model = read("server/models/lms-integration.model.ts");
  const service = read("server/services/lms-integration.service.ts");
  const controller = read("server/controllers/lms-integration.controller.ts");
  const jobs = read("server/jobs/index.ts");
  assert.match(model, /syncSchedule/);
  assert.match(service, /runDueProfiles/);
  assert.match(service, /retryRun/);
  assert.match(controller, /LMS_SYNC_COMPLETED/);
  assert.match(controller, /LMS_SYNC_RETRIED/);
  assert.match(jobs, /startLmsSyncJob/);
});

test("provider catalogue, enrollments, progress and credentials are governed", () => {
  const model = read("server/models/lms-integration.model.ts");
  const service = read("server/services/lms-integration.service.ts");
  const routes = read("server/routes/lms-integration.routes.ts");
  const controller = read("server/controllers/lms-integration.controller.ts");
  assert.match(model, /LmsCourseModel/);
  assert.match(model, /LmsEnrollmentModel/);
  assert.match(model, /LmsCredentialModel/);
  assert.match(service, /assignCourse/);
  assert.match(service, /importProgress/);
  assert.match(service, /syncProviderCatalog/);
  assert.match(service, /syncProviderProgress/);
  assert.match(service, /externalConnectorService\.execute/);
  assert.match(routes, /courses\/:id\/assign/);
  assert.match(routes, /progress\/import/);
  assert.match(routes, /credentials\/me/);
  assert.match(controller, /LMS_COURSE_ASSIGNED/);
  assert.match(controller, /LMS_PROGRESS_IMPORTED/);
  assert.match(controller, /LMS_CATALOG_SYNCHRONIZED/);
  assert.match(controller, /LMS_PROGRESS_SYNCHRONIZED/);
});
