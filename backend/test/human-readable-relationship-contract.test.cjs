const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("gradebook and meeting APIs populate user-facing relationship data", () => {
  const gradebook = read("services/assessment-gradebook.service.ts");
  const meeting = read("repositories/meeting.repository.ts");

  assert.match(gradebook, /populate\("studentId", "name email studentId"\)/);
  assert.match(gradebook, /populate\("subjectId", "name code"\)/);
  assert.match(meeting, /populate\("attendees\.userId", "name email studentId facultyId"\)/);
});

test("library dashboard returns book and member labels instead of bare identifiers", () => {
  const dashboard = read("services/dashboard.service.ts");
  assert.match(
    dashboard,
    /populate\("bookId", "title isbn authors shelfLocation coverImageUrl"\)/,
  );
  assert.match(dashboard, /populate\("memberId", "name email studentId facultyId"\)/);
});
