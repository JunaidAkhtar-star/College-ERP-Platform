const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.resolve(__dirname, "../server/routes/search.routes.ts"),
  "utf8",
);

test("HOD option requests derive department scope from the authenticated account", () => {
  assert.match(source, /req\.activeRole === SystemRole\.HOD/);
  assert.match(source, /await getDepartmentScope\(req\)/);
  assert.match(source, /optionParams\["_departmentScope"\] = departmentScope/);
  assert.match(source, /optionParams\["departmentId"\] = departmentScope/);
  assert.match(source, /delete optionParams\["departmentIds"\]/);
});

test("HOD department scope reaches every academic people and structure selector", () => {
  assert.match(source, /optionsStudents[\s\S]*?filter\["department"\]/);
  assert.match(source, /optionsStudentProfiles[\s\S]*?filter\["department"\]/);
  assert.match(source, /optionsFaculty[\s\S]*?params\?\.\["departmentId"\]/);
  assert.match(source, /optionsUsers[\s\S]*?filter\["department"\]/);
  assert.match(source, /optionsDepartments[\s\S]*?departmentScope/);
  assert.match(source, /optionsCurricula[\s\S]*?curriculumIds/);
  assert.match(source, /optionsBatches[\s\S]*?_departmentScope/);
  assert.match(source, /optionsPrograms[\s\S]*?curriculumIds/);
});
