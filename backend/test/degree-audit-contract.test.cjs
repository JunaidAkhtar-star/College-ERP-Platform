const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("degree audit derives completion from authoritative curriculum and published results", () => {
  const source = read("server/services/degree-audit.service.ts");
  assert.match(source, /CurriculumModel\.findOne/);
  assert.match(
    source,
    /SemesterResultModel\.find\(\{ studentId: student\.userId, isPublished: true \}\)/,
  );
  assert.match(source, /TransferCreditEvaluationModel\.find/);
  assert.match(source, /graduationReady: remainingCredits === 0 && backlogs === 0/);
});

test("academic plans and transfer credits use governed states and tenant audit models", () => {
  const model = read("server/models/degree-audit.model.ts");
  const routes = read("server/routes/degree-audit.routes.ts");
  assert.match(model, /TransferCreditEvaluationSchema\.plugin\(auditPlugin\)/);
  assert.match(model, /AcademicPlanSchema\.plugin\(auditPlugin\)/);
  assert.match(routes, /requireRoles\(\[STUDENT\]\)/);
  assert.match(routes, /\/plan\/review/);
  assert.match(routes, /\/transfer-credits\/:id\/review/);
  assert.match(routes, /body\("courses\.\*\.targetSubjectId"\)\.optional\(\)\.isMongoId\(\)/);
});

test("degree audit enforces student ownership, department scope, and faculty advising scope", () => {
  const controller = read("server/controllers/degree-audit.controller.ts");
  const search = read("server/routes/search.routes.ts");
  assert.match(controller, /ownedProfileId\(req\.user!\._id\.toString\(\)\)/);
  assert.match(controller, /assertDegreeAuditAccess/);
  assert.match(controller, /req\.activeRole !== SystemRole\.FACULTY/);
  assert.match(controller, /MentorModel\.exists/);
  assert.match(controller, /assigned advisees/);
  assert.match(search, /params\?\.\["assignedOnly"\] && params\?\.\["_facultyId"\]/);
  assert.match(search, /MentorModel\.find\(\{ facultyId, isActive: true \}\)/);
  assert.doesNotMatch(controller, /req\.body\.studentId/);
});
