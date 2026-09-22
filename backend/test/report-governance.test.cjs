const assert = require("node:assert/strict");
const test = require("node:test");

const { matchesReportCron } = require("../build/jobs/report-schedule.job");

test("report schedules match exact, stepped, ranged and listed cron fields", () => {
  const mondayAtNineThirty = new Date("2026-07-20T04:00:00.000Z");
  assert.equal(matchesReportCron("30 9 * * 1", mondayAtNineThirty, "Asia/Kolkata"), true);
  assert.equal(matchesReportCron("*/15 9-17 * * 1-5", mondayAtNineThirty, "Asia/Kolkata"), true);
  assert.equal(matchesReportCron("0,30 9 * * 1", mondayAtNineThirty, "Asia/Kolkata"), true);
  assert.equal(matchesReportCron("0 9 * * 1", mondayAtNineThirty, "Asia/Kolkata"), false);
});

test("report schedule matching fails closed for malformed expressions and timezones", () => {
  const date = new Date("2026-07-20T04:00:00.000Z");
  assert.equal(matchesReportCron("* * *", date, "Asia/Kolkata"), false);
  assert.equal(matchesReportCron("*/0 * * * *", date, "Asia/Kolkata"), false);
  assert.equal(matchesReportCron("* * * * *", date, "Invalid/Timezone"), false);
});
