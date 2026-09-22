const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("academic structure routes use separate governed permissions", () => {
  assert.match(read("server/routes/batch.routes.ts"), /Module\.BATCH_MANAGEMENT/);
  assert.match(read("server/routes/section.routes.ts"), /Module\.SECTION_MANAGEMENT/);
  assert.match(
    read("server/routes/student-section-allotment.routes.ts"),
    /Module\.STUDENT_ALLOTMENT/,
  );
});

test("HOD authority is department operational rather than institution structural", () => {
  const defaults = read("server/constants/role-defaults.ts");
  const hod = defaults.slice(
    defaults.indexOf("[SystemRole.HOD]"),
    defaults.indexOf("[SystemRole.FACULTY]"),
  );
  assert.match(hod, /\[M\.BATCH_MANAGEMENT\]: VIEW_ONLY/);
  assert.match(hod, /\[M\.SECTION_MANAGEMENT\]: VIEW_EDIT/);
  assert.match(hod, /\[M\.STUDENT_ALLOTMENT\]: \[A\.VIEW, A\.EDIT\]/);
});

test("section proposals require approval before activation", () => {
  const service = read("server/services/section.service.ts");
  const routes = read("server/routes/section.routes.ts");
  assert.match(service, /status: SectionStatus\.PLANNED/);
  assert.match(service, /Only a planned section can be approved/);
  assert.match(routes, /"\/:id\/approve"/);
  assert.match(routes, /canApprove/);
});

test("allotment preview transfer execution and cancellation have distinct authority", () => {
  const routes = read("server/routes/student-section-allotment.routes.ts");
  assert.match(routes, /"\/bulk\/preview"[\s\S]*?canView/);
  assert.match(routes, /"\/bulk\/execute"[\s\S]*?canApprove/);
  assert.match(routes, /"\/:id\/transfer"[\s\S]*?canEdit/);
  assert.match(routes, /"\/:id\/cancel"[\s\S]*?canApprove/);
});
