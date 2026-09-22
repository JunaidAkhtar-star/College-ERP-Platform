const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("report filters coerce and validate numeric and date values", () => {
  const service = read("server/services/report-center.service.ts");

  assert.match(service, /Number\.isFinite\(number\)/);
  assert.match(service, /Number\.isNaN\(date\.getTime\(\)\)/);
  assert.match(service, /\$lte: typedValue\(field, filter\.secondValue\)/);
});

test("report execution and sharing remain active-role and department scoped", () => {
  const service = read("server/services/report-center.service.ts");
  const controller = read("server/controllers/report-center.controller.ts");

  assert.match(controller, /req\.activeRole/);
  assert.match(service, /allowedRoles: role/);
  assert.match(
    service,
    /query\[dataset\.scopeField\] = new Types\.ObjectId\(context\.departmentId\)/,
  );
  assert.match(service, /Private reports can only be scheduled to yourself/);
  assert.match(service, /Department-scoped reports cannot be sent outside your department/);
});
