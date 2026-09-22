const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertStudentStatusTransition,
  redactStudentProfile,
} = require("../build/services/student-profile.service.js");
const { parentWardView } = require("../build/services/parent.service.js");

test("student lifecycle permits governed non-terminal transitions only", () => {
  assert.doesNotThrow(() => assertStudentStatusTransition("active", "detained"));
  assert.doesNotThrow(() => assertStudentStatusTransition("detained", "active"));
  assert.throws(() => assertStudentStatusTransition("active", "passed_out"), /cannot change/);
  assert.throws(() => assertStudentStatusTransition("dropped", "active"), /cannot change/);
});

test("staff-safe student view removes identity, family, finance, and internal fields", () => {
  const result = redactStudentProfile({
    rollNumber: "26RE001",
    aadhaarNumber: "encrypted",
    parentInfo: { fatherPhone: "9999999999" },
    feeRecords: [{ amount: 100 }],
    remarks: "internal",
  });
  assert.equal(result.rollNumber, "26RE001");
  assert.equal("aadhaarNumber" in result, false);
  assert.equal("parentInfo" in result, false);
  assert.equal("feeRecords" in result, false);
  assert.equal("remarks" in result, false);
});

test("parent ward view exposes academic summary without sensitive identity data", () => {
  const result = parentWardView({
    rollNumber: "26RE001",
    firstName: "Student",
    aadhaarNumber: "encrypted",
    parentInfo: { fatherName: "Parent", fatherPhone: "9999999999", motherName: "Parent" },
    totalFeeDue: 5000,
    remarks: "internal",
  });
  assert.equal(result.rollNumber, "26RE001");
  assert.equal("aadhaarNumber" in result, false);
  assert.equal("parentInfo" in result, false);
  assert.equal("totalFeeDue" in result, false);
  assert.equal("remarks" in result, false);
});
