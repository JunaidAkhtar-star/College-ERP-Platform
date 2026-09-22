const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeAcademicCalendar,
  normalizeCalendarEvent,
} = require("../build/services/academic-calendar.service.js");
const {
  assertBatchStatusTransition,
  curriculumReferenceId,
} = require("../build/services/batch.service.js");
const { planBulkAllotments } = require("../build/services/student-section-allotment.service.js");
const { normalizeCurriculumPayload } = require("../build/services/curriculum.service.js");

test("derives working days and excludes weekday holidays", () => {
  const calendar = normalizeAcademicCalendar({
    academicYear: "2026-27",
    semesterType: "odd",
    semesterStartDate: "2026-07-20",
    semesterEndDate: "2026-07-24",
    events: [
      {
        title: "Foundation Day",
        startDate: "2026-07-22",
        endDate: "2026-07-22",
        category: "holiday",
      },
    ],
  });
  assert.equal(calendar.totalWorkingDays, 4);
});

test("rejects calendar events outside the governed semester", () => {
  assert.throws(
    () =>
      normalizeCalendarEvent(
        {
          title: "Invalid event",
          startDate: "2026-07-19",
          endDate: "2026-07-20",
          category: "other",
        },
        new Date("2026-07-20"),
        new Date("2026-11-30"),
      ),
    /within the semester/,
  );
});

test("curriculum creates contiguous plans and authoritative totals", () => {
  const subjectId = "507f1f77bcf86cd799439011";
  const curriculum = normalizeCurriculumPayload({
    program: "BTECH",
    academicLevel: "undergraduate",
    openForAdmissions: true,
    regulationYear: "2026",
    totalSemesters: 2,
    totalCreditsRequired: 4,
    semesterPlans: [
      {
        semesterNo: 1,
        totalCredits: 999,
        subjects: [{ subjectId, credits: 4, theoryHours: 3, labHours: 2 }],
      },
    ],
  });
  assert.deepEqual(
    curriculum.semesterPlans.map((plan) => plan.semesterNo),
    [1, 2],
  );
  assert.equal(curriculum.semesterPlans[0].totalCredits, 4);
  assert.equal(curriculum.semesterPlans[0].totalTheoryHours, 3);
});

test("batch lifecycle permits only forward governed transitions", () => {
  assert.doesNotThrow(() => assertBatchStatusTransition("Planned", "Active"));
  assert.throws(() => assertBatchStatusTransition("Active", "Archived"), /cannot change/);
  assert.throws(() => assertBatchStatusTransition("Passed Out", "Active"), /cannot change/);
});

test("batch curriculum matching supports populated department references", () => {
  const curriculumId = "507f1f77bcf86cd799439011";
  assert.equal(curriculumReferenceId(curriculumId), curriculumId);
  assert.equal(curriculumReferenceId({ _id: curriculumId, program: "B.Tech" }), curriculumId);
});

test("bulk section plans support sequential, balanced, and merit-rank strategies", () => {
  const sections = ["A", "B", "C"].map((name) => ({
    id: name,
    name,
    capacity: 60,
    allottedCount: 0,
  }));
  const students = Array.from({ length: 100 }, (_, index) => ({
    userId: String(index + 1),
    rollNumber: String(index + 1),
    meritRank: 100 - index,
  }));

  const sequential = planBulkAllotments(students, sections, "sequential");
  assert.deepEqual(
    sequential.sections.map((section) => section.newStudents),
    [60, 40, 0],
  );

  const balanced = planBulkAllotments(students, sections, "balanced");
  assert.deepEqual(
    balanced.sections.map((section) => section.newStudents),
    [34, 33, 33],
  );

  const merit = planBulkAllotments(students, sections, "merit_rank");
  assert.equal(merit.assignments[0].meritRank, 1);
  assert.equal(merit.assignments[0].sectionName, "A");
});
