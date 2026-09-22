const assert = require("node:assert/strict");
const test = require("node:test");
const { assertFacultyStatusTransition } = require("../build/services/faculty-profile.service.js");
const { assertEmploymentStatusTransition } = require("../build/services/hr.service.js");
const { normalizeFacultyWorkload } = require("../build/services/faculty-workload.service.js");

test("faculty and HR lifecycle transitions cannot revive terminal records", () => {
  assert.doesNotThrow(() => assertFacultyStatusTransition("active", "resigned"));
  assert.throws(() => assertFacultyStatusTransition("resigned", "active"), /cannot change/);
  assert.doesNotThrow(() => assertEmploymentStatusTransition("on_leave", "active"));
  assert.throws(() => assertEmploymentStatusTransition("terminated", "active"), /cannot change/);
});

test("faculty workload derives totals and rejects duplicate or excessive allocation", () => {
  const valid = normalizeFacultyWorkload({
    academicYear: "2026-27",
    semesterType: "odd",
    teachingAssignments: [
      {
        subjectId: "507f1f77bcf86cd799439011",
        program: "BTECH",
        semester: 1,
        section: "A",
        classType: "theory",
        weeklyHours: 12,
        totalHours: 48,
      },
    ],
    extraDuties: [{ type: "mentor", description: "Mentoring", weeklyHours: 3 }],
  });
  assert.equal(valid.totalWeeklyTeachingHours, 12);
  assert.equal(valid.totalWeeklyHours, 15);
  assert.throws(
    () => normalizeFacultyWorkload({ ...valid, extraDuties: [{ weeklyHours: 50 }] }),
    /cannot exceed 60|invalid/,
  );
});
