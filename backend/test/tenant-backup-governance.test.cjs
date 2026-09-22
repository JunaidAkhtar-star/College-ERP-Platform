const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("tenant backups are encrypted, tenant-scoped and replica-safe", () => {
  const service = read("server/services/tenant-backup.service.ts");
  const routes = read("server/routes/tenant-backup.routes.ts");
  const job = read("server/jobs/tenant-backup.job.ts");

  assert.match(service, /createCipheriv\("aes-256-gcm"/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /tenantLocalStorage\.getStore\(\)/);
  assert.match(service, /configs\.MONGODUMP_PATH/);
  assert.match(service, /enforceRetention/);
  assert.match(service, /cryptoUtil\.encrypt\(token\.refresh_token\)/);
  assert.doesNotMatch(routes, /refresh_token/);
  assert.match(routes, /authenticate, administrators/);
  assert.match(job, /withSchedulerLease\("master:tenant-backup-dispatch"/);
});

test("tenant backups expose durable stage progress and understandable failure reasons", () => {
  const model = read("server/models/tenant-backup.model.ts");
  const service = read("server/services/tenant-backup.service.ts");

  assert.match(model, /progress: \{ type: Number, min: 0, max: 100/);
  assert.match(model, /progressMessage/);
  assert.match(model, /failureCode/);
  assert.match(service, /updateProgress/);
  assert.match(service, /EXPORT_TOOL_UNAVAILABLE/);
  assert.match(service, /DRIVE_AUTH_EXPIRED/);
  assert.match(service, /DRIVE_STORAGE_FULL/);
  assert.match(service, /BACKUP_TIMEOUT/);
  assert.match(service, /access\(configs\.MONGODUMP_PATH, constants\.X_OK\)/);
});

test("backup overview reports only current tenant identity and database size", () => {
  const service = read("server/services/tenant-backup.service.ts");

  assert.match(service, /InstitutionSettingModel\.findOne\(\)\.select\("name"\)/);
  assert.match(service, /command\(\{ dbStats: 1, scale: 1 \}\)/);
  assert.match(service, /tenantId: store\?\.tenantId/);
  assert.match(service, /databaseName: store\?\.tenantDb\.name/);
  assert.match(service, /activeJob: activeJob \?\? null/);
});
