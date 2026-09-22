const assert = require("node:assert/strict");
const test = require("node:test");
const {
  attendanceEquivalent,
  normalizeAttendanceDate,
} = require("../build/services/faculty-attendance.service.js");

test("normalizes faculty attendance to one record per local calendar date", () => {
  const normalized = normalizeAttendanceDate(new Date(2026, 6, 20, 16, 45));
  assert.equal(normalized.getHours(), 0);
  assert.equal(normalized.getMinutes(), 0);
  assert.equal(normalized.getDate(), 20);
});

test("weights late and half-day attendance correctly", () => {
  assert.equal(attendanceEquivalent("present"), 1);
  assert.equal(attendanceEquivalent("late"), 1);
  assert.equal(attendanceEquivalent("half_day"), 0.5);
  assert.equal(attendanceEquivalent("absent"), 0);
  assert.equal(attendanceEquivalent("on_leave"), 0);
});
