const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeNaacEvidence,
  normalizeNbaReport,
} = require("../build/services/naac-nba.service.js");
const { normalizeIqacFeedback } = require("../build/services/iqac.service.js");

test("NAAC evidence requires criterion-aligned metrics and secure evidence", () => {
  const evidence = normalizeNaacEvidence({
    criterion: "3",
    metricNo: "3.2.1",
    title: "Research grants",
    academicYear: "2026-27",
    evidenceFiles: [{ name: "Grant register", url: "https://files.example.edu/grants.pdf" }],
    status: "approved",
  });
  assert.equal(evidence.status, undefined);
  assert.throws(() => normalizeNaacEvidence({ ...evidence, metricNo: "2.1.1" }), /criterion/);
});

test("NBA report threshold is derived from authoritative PO attainment", () => {
  const report = normalizeNbaReport({
    coAttainments: [
      {
        courseCode: "CS101",
        courseName: "Programming",
        coCode: "CO1",
        coStatement: "Apply programming constructs",
        directAttainment: 70,
        indirectAttainment: 60,
        finalAttainment: 68,
        attainmentLevel: 2,
      },
    ],
    poAttainments: [{ poCode: "PO1", poStatement: "Engineering knowledge", attainmentLevel: 65 }],
    thresholdMet: false,
  });
  assert.equal(report.thresholdMet, true);
});

test("IQAC feedback derives averages and enforces respondent role", () => {
  const feedback = normalizeIqacFeedback(
    {
      academicYear: "2026-27",
      semesterType: "odd",
      feedbackType: "student_on_faculty",
      targetId: "507f1f77bcf86cd799439011",
      ratings: [
        { criterion: "Preparation", score: 4 },
        { criterion: "Delivery", score: 5 },
      ],
    },
    ["student"],
  );
  assert.equal(feedback.averageScore, 4.5);
  assert.throws(
    () => normalizeIqacFeedback({ ...feedback, feedbackType: "faculty_on_curriculum" }, ["student"]),
    /role/,
  );
});
