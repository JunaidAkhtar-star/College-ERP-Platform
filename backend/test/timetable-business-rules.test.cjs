const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertTimetableSlotLayout,
  buildBalancedTimetableCandidates,
} = require("../build/services/timetable.service.js");

const slot = {
  day: "Monday",
  periodNo: 1,
  startTime: "09:00",
  endTime: "10:00",
  facultyId: "faculty-1",
  roomNo: "A-101",
  classType: "theory",
};

test("rejects invalid and overlapping section timetable slots", () => {
  assert.throws(
    () => assertTimetableSlotLayout([{ ...slot, endTime: "08:00" }]),
    /Invalid time range/,
  );
  assert.throws(
    () =>
      assertTimetableSlotLayout([
        slot,
        {
          ...slot,
          periodNo: 2,
          startTime: "09:30",
          endTime: "10:30",
          facultyId: "faculty-2",
          roomNo: "A-102",
        },
      ]),
    /Section has overlapping classes/,
  );
});

test("allows split labs only with distinct faculty, room, and batch", () => {
  const labA = { ...slot, classType: "lab", labBatch: "A1" };
  const labB = {
    ...labA,
    facultyId: "faculty-2",
    roomNo: "LAB-2",
    labBatch: "A2",
  };
  assert.doesNotThrow(() => assertTimetableSlotLayout([labA, labB]));
  assert.throws(
    () => assertTimetableSlotLayout([labA, { ...labB, roomNo: "a-101" }]),
    /Room A-101 is assigned twice/,
  );
});

test("balances generated timetable candidates across the week", () => {
  const periods = [{ periodNo: 1 }, { periodNo: 2 }];
  assert.deepEqual(
    buildBalancedTimetableCandidates(["Monday", "Tuesday", "Wednesday"], periods, 0).map(
      ({ day, timing }) => `${day}:${timing.periodNo}`,
    ),
    ["Monday:1", "Tuesday:1", "Wednesday:1", "Monday:2", "Tuesday:2", "Wednesday:2"],
  );
  assert.equal(
    buildBalancedTimetableCandidates(["Monday", "Tuesday"], periods, 1)[0].day,
    "Tuesday",
  );
});
