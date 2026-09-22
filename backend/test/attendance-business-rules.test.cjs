const assert = require("node:assert/strict");
const test = require("node:test");
const {
  canModifyAttendanceAt,
  parseAttendanceDate,
} = require("../build/services/attendance.service.js");

test("allows attendance marking from class completion through 24 hours afterward", () => {
  const classDate = new Date(2026, 6, 20);
  assert.equal(canModifyAttendanceAt(classDate, "10:00", new Date(2026, 6, 20, 9, 59)), false);
  assert.equal(canModifyAttendanceAt(classDate, "10:00", new Date(2026, 6, 20, 10, 0)), true);
  assert.equal(canModifyAttendanceAt(classDate, "10:00", new Date(2026, 6, 21, 9, 59)), true);
  assert.equal(canModifyAttendanceAt(classDate, "10:00", new Date(2026, 6, 21, 10, 1)), false);
  assert.equal(canModifyAttendanceAt(classDate, "bad-time", new Date(2026, 6, 20, 10, 0)), false);
});

test("parses attendance dates as institution-local calendar dates", () => {
  const date = parseAttendanceDate("2026-08-12");
  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 7);
  assert.equal(date.getDate(), 12);
  assert.equal(parseAttendanceDate("2026-02-30"), null);
  assert.equal(parseAttendanceDate("12/08/2026"), null);
});
