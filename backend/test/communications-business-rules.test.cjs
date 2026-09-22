const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeNotice } = require("../build/services/notice.service.js");
const { normalizeMeeting } = require("../build/services/meeting.service.js");
const fs = require("node:fs");
const path = require("node:path");

test("notice governance always creates a validated draft", () => {
  const notice = normalizeNotice({
    title: "  Examination schedule  ",
    content: "The final examination schedule has been published.",
    noticeType: "role_based",
    targetRoles: ["student"],
    isPublished: true,
    publishedBy: "untrusted",
  });
  assert.equal(notice.title, "Examination schedule");
  assert.equal(notice.isPublished, false);
  assert.equal(notice.publishedBy, undefined);
  assert.throws(
    () => normalizeNotice({ ...notice, expiryDate: "2020-01-01T00:00:00.000Z" }),
    /future/,
  );
});

test("communication campaigns enforce HOD department scope and owner mutations", () => {
  const controller = fs.readFileSync(
    path.join(__dirname, "../server/controllers/communication-hub.controller.ts"),
    "utf8",
  );
  const service = fs.readFileSync(
    path.join(__dirname, "../server/services/communication-hub.service.ts"),
    "utf8",
  );
  assert.match(controller, /HOD communication is limited to the active department/);
  assert.match(controller, /targetDepartments: \[departmentId\]/);
  assert.match(controller, /campaignScope\(req\)/);
  assert.match(service, /canManageAll \? \{\} : \{ createdBy: userId \}/);
  assert.match(service, /input\.targetDepartments\?\.length\s*\|\|\s*input\.targetPrograms/);
});

test("suppression management is limited to system administrators", () => {
  const routes = fs.readFileSync(
    path.join(__dirname, "../server/routes/communication-hub.routes.ts"),
    "utf8",
  );
  assert.match(routes, /suppressionManagers = requireRoles\(\[SystemRole\.SUPER_ADMIN, SystemRole\.ADMIN\]\)/);
  assert.match(routes, /targetDepartments\.\*"\)\.optional\(\)\.isMongoId/);
  assert.match(routes, /targetUserIds\.\*"\)\.optional\(\)\.isMongoId/);
});

test("meeting governance enforces future scheduling, duration and secure links", () => {
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const meeting = normalizeMeeting({
    title: "Academic council",
    agenda: "Review the semester delivery plan",
    meetingType: "faculty",
    scheduledAt,
    mode: "online",
    meetingLink: "https://meet.example.edu/council",
    durationMinutes: 60,
  });
  assert.equal(meeting.durationMinutes, 60);
  assert.throws(
    () => normalizeMeeting({ ...meeting, meetingLink: "http://unsafe.example.test" }),
    /HTTPS/,
  );
});
