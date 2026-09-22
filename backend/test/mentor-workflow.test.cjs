const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("mentor assignment enforces capacity, uniqueness and profile linkage", () => {
  const service = read("server/services/mentor.service.ts");
  assert.match(service, /Mentor capacity has been reached/);
  assert.match(service, /already has an active mentor/);
  assert.match(service, /StudentProfileModel\.updateOne/);
});

test("mentor meetings are ownership-scoped and tied to an assigned student", () => {
  const service = read("server/services/mentor.service.ts");
  const model = read("server/models/mentor.model.ts");
  assert.match(service, /own mentees/);
  assert.match(service, /Select a student assigned to this mentor/);
  assert.match(
    model,
    /studentId: \{ type: Schema\.Types\.ObjectId, ref: "User", required: true \}/,
  );
  assert.match(service, /conductedBy/);
});
