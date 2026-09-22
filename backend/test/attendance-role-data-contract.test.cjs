const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "server");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("attendance ownership is enforced for student, faculty, and department roles", () => {
  const controller = read("controllers/attendance.controller.ts");

  assert.match(controller, /Students can view only their own attendance summary/);
  assert.match(controller, /Faculty can view only their own attendance records/);
  assert.match(controller, /await assertDepartmentAccess\(req, data\.departmentId\)/);
  assert.match(controller, /const filter = await applyDepartmentScope\(req, \{\}\)/);
});

test("HOD shortage access is department scoped while locking remains leadership only", () => {
  const routes = read("routes/attendance.routes.ts");
  const controller = read("controllers/attendance.controller.ts");

  assert.match(routes, /const shortageReader = requireRoles/);
  assert.match(routes, /SystemRole\.HOD/);
  assert.match(routes, /"\/shortage",\s*auth,\s*shortageReader/);
  assert.match(routes, /"\/lock", auth, admin/);
  assert.match(controller, /getShortageList:\s*async[\s\S]*?getDepartmentScope\(req\)/);
});

test("Dean Academic can inspect student summaries without receiving attendance marking access", () => {
  const routes = read("routes/attendance.routes.ts");

  assert.match(
    routes,
    /const studentSummaryReader = requireRoles\(\[[\s\S]*?SystemRole\.DEAN_ACADEMIC[\s\S]*?\]\)/,
  );
  assert.match(
    routes,
    /"\/student\/:studentId\/summary",[\s\S]*?auth,\s*studentSummaryReader,\s*attendanceController\.getStudentSummary/,
  );
  assert.match(routes, /router\.post\(\s*"\/",\s*auth,\s*faculty,/);
  const facultyGuard = routes.match(/const faculty = requireRoles\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
  assert.doesNotMatch(facultyGuard, /SystemRole\.DEAN_ACADEMIC/);
});

test("attendance summaries and shortage rows expose real human-readable relationships", () => {
  const repository = read("repositories/attendance.repository.ts");
  const service = read("services/attendance.service.ts");

  assert.match(repository, /populate\("subjectId", "name code"\)/);
  assert.match(repository, /populate\("studentId", "name email avatar"\)/);
  assert.match(service, /subjectName: subject\?\.name \?\? null/);
  assert.match(service, /studentName: student\?\.name \?\? "Student"/);
  assert.match(service, /rollNo: summary\.rollNumber/);
  assert.match(service, /\.populate\("department", "name code"\)/);
});

test("attendance sessions use timetable-slot identity and day-range reads", () => {
  const repository = read("repositories/attendance.repository.ts");
  const service = read("services/attendance.service.ts");

  assert.match(repository, /\.\.\.\(slotId \? \[\{ timetableSlotId: slotId \}\] : \[\]\)/);
  assert.match(repository, /date: \{ \$gte: date, \$lt: nextDate \}/);
  assert.match(service, /data\.timetableSlotId,\s*data\.timetableId/);
  assert.match(service, /parseAttendanceDate\(data\.date\)/);
  assert.match(service, /function attendanceDateKey\(value: Date\): string/);
  assert.doesNotMatch(service, /day\.toISOString\(\)\.slice\(0, 10\)/);
});

test("faculty attendance records expose student names, rolls, and department codes", () => {
  const service = read("services/attendance.service.ts");

  assert.match(
    service,
    /userId firstName middleName lastName rollNumber department program currentSemester/,
  );
  assert.match(service, /\{ _id: \{ \$in: studentIds \} \}/);
  assert.match(service, /\.populate\("userId", "name"\)/);
  assert.match(service, /\.populate\("department", "name code"\)/);
  assert.match(service, /studentName:/);
  assert.match(service, /departmentCode:/);
  assert.match(service, /semester: profile\?\.currentSemester/);
});

test("attendance alerts dynamically target students, assigned mentors, and linked parents", () => {
  const service = read("services/attendance.service.ts");

  assert.match(service, /AttendanceStatus\.ABSENT, AttendanceStatus\.LATE/);
  assert.match(service, /before !== entry\.status/);
  assert.match(service, /notifyUsers\(absentStudentIds/);
  assert.match(service, /notifyUsers\(mentorIds/);
  assert.match(service, /fatherEmail/);
  assert.match(service, /motherEmail/);
  assert.match(service, /guardianEmail/);
  assert.match(service, /roles: \{ \$in: \[SystemRole\.PARENT\] \}/);
  assert.match(service, /Attendance status corrected/);
  assert.match(service, /await Promise\.all\(batchTasks\)/);
});
