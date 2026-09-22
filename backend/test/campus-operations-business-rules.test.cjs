const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeEvent } = require("../build/services/event.service.js");

test("event governance derives safe draft fields and ordered dates", () => {
  const event = normalizeEvent({
    title: "Innovation Day",
    description: "Student innovation showcase",
    venue: "Auditorium",
    eventType: "technical",
    startDate: "2026-08-01T09:00:00.000Z",
    endDate: "2026-08-01T17:00:00.000Z",
    targetAudience: ["student", "student", "faculty"],
    maxRegistrations: 100,
  });
  assert.deepEqual(event.targetAudience, ["student", "faculty"]);
  assert.equal(event.maxRegistrations, 100);
  assert.throws(
    () => normalizeEvent({ ...event, endDate: "2026-07-31T17:00:00.000Z" }),
    /dates are invalid/,
  );
});
