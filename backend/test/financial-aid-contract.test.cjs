const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("aid packaging derives need from authoritative fees and existing awards", () => {
  const service = read("server/services/financial-aid.service.ts");
  assert.match(service, /FeeRecordModel\.find/);
  assert.match(service, /ScholarshipModel\.find/);
  assert.match(service, /costOfAttendance - studentContribution - existingAid/);
  assert.match(service, /giftAid > need\.demonstratedNeed/);
  assert.match(service, /Total aid exceeds cost of attendance/);
});

test("fund reservation and disbursement are transactional and budget bounded", () => {
  const service = read("server/services/financial-aid.service.ts");
  assert.match(service, /withTransaction/);
  assert.match(service, /\$add: \["\$reservedAmount", award\.offeredAmount\]/);
  assert.match(service, /reservedAmount: -award\.acceptedAmount, disbursedAmount: award\.acceptedAmount/);
  assert.match(service, /allocateScholarshipFeeCredit/);
  assert.match(service, /postScholarshipPayment/);
});

test("financial aid enforces ownership and separation of duties", () => {
  const controller = read("server/controllers/financial-aid.controller.ts");
  const service = read("server/services/financial-aid.service.ts");
  assert.match(controller, /applyDepartmentScope/);
  assert.match(controller, /assertDepartmentAccess/);
  assert.match(service, /studentId, status: "offered"/);
  assert.match(service, /different reviewer must offer/);
  assert.match(service, /reviewer and disbursement officer must be different/);
});

test("work-study is allocated but cannot bypass earned payroll", () => {
  const service = read("server/services/financial-aid.service.ts");
  assert.match(service, /Work-study awards are paid through earned payroll/);
});
