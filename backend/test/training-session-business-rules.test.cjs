const assert = require("node:assert/strict");
const test = require("node:test");
const {
  evaluateTrainingEligibility,
  normalizeTrainingSession,
} = require("../build/services/training-session.service.js");

const valid = {
  title: "Interview workshop",
  type: "Mock Interview",
  mode: "Offline",
  facilitator: "Industry trainer",
  venue: "Seminar hall",
  scheduledDate: "2099-08-15T00:00:00.000Z",
  registrationStart: "2099-08-01T00:00:00.000Z",
  registrationEnd: "2099-08-14T12:00:00.000Z",
  startTime: "10:00",
  endTime: "12:00",
  targetBranches: ["CSE", "CSE"],
};

test("derives training duration and normalizes target groups", () => {
  const normalized = normalizeTrainingSession(valid, true);
  assert.equal(normalized.duration, 120);
  assert.deepEqual(normalized.targetBranches, ["CSE"]);
});

test("requires an ordered registration window and session time", () => {
  assert.throws(
    () => normalizeTrainingSession({ ...valid, endTime: "09:00" }),
    /End time must be after/,
  );
  assert.throws(
    () =>
      normalizeTrainingSession({
        ...valid,
        registrationEnd: "2099-08-16T00:00:00.000Z",
      }),
    /Registration window/,
  );
});

test("online training requires a safe meeting destination", () => {
  assert.throws(
    () => normalizeTrainingSession({ ...valid, mode: "Online", meetingLink: "javascript:x" }),
    /meeting link/,
  );
});

test("evaluates all targeted training dimensions", () => {
  const session = {
    targetPrograms: ["B.Tech"],
    targetBranches: ["CSE"],
    targetBatches: ["2026"],
    targetSemesters: [8],
  };
  assert.deepEqual(
    evaluateTrainingEligibility(session, {
      program: "B.Tech",
      branch: "CSE",
      batch: "2026",
      currentSemester: 8,
    }),
    { eligible: true, reasons: [] },
  );
  const failed = evaluateTrainingEligibility(session, {
    program: "BCA",
    branch: "IT",
    batch: "2025",
    currentSemester: 6,
  });
  assert.equal(failed.reasons.length, 4);
});
