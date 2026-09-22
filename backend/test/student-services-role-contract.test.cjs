const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("library catalogue and digital routes reject unrelated authenticated roles", () => {
  const routes = read("routes/library.routes.ts");
  assert.match(routes, /const LIBRARY_READERS = \[SUPER_ADMIN, ADMIN, PRINCIPAL, LIBRARY_STAFF, FACULTY, STUDENT\]/);
  assert.match(routes, /"\/books", authenticate, requireRoles\(LIBRARY_READERS\)/);
  assert.match(routes, /"\/digital", authenticate, requireRoles\(LIBRARY_READERS\)/);
  assert.match(routes, /"\/issues\/my"[\s\S]*?requireRoles\(\[FACULTY, STUDENT\]\)/);
});

test("library renewals enforce member ownership outside library staff", () => {
  const service = read("services/library.service.ts");
  assert.match(service, /issue\.memberId\.toString\(\) !== requesterId/);
  assert.match(service, /You can renew only your own issued books/);
});

test("hostel student lists are self-scoped by active role", () => {
  const controller = read("controllers/hostel.controller.ts");
  assert.match(controller, /req\.activeRole === SystemRole\.STUDENT[\s\S]*?filter\.studentId = req\.user!\._id/);
  assert.match(controller, /Hostel records are restricted to residents and hostel staff/);
});

test("transport public catalogue is limited to supported transport readers", () => {
  const routes = read("routes/transport.routes.ts");
  const controller = read("controllers/transport.controller.ts");
  assert.match(routes, /router\.get\("\/routes", authenticate, transportReaders/);
  assert.match(controller, /req\.activeRole === SystemRole\.STUDENT\) filter\.studentId = req\.user!\._id/);
});
