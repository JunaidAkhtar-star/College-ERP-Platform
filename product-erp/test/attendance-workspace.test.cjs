const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/features/role-wise-features/attendance/components/AttendancePage.tsx'),
  'utf8',
);

test('timetable attendance submits the authoritative timetable slot', () => {
  assert.match(source, /timetableSlotId: s\._id/);
  assert.match(source, /sectionId:/);
  assert.match(source, /Attendance can be marked only from your approved timetable/);
});

test('attendance workflows never ask users for database identifiers', () => {
  assert.doesNotMatch(source, /Attendance Record ID|Subject ID|Student ID|valid ObjectId/);
  assert.match(source, /type="subjects"/);
  assert.match(source, /type="students"/);
  assert.match(source, /type="academicYears"/);
});

test('student corrections are selected from owned attendance sessions', () => {
  assert.match(source, /attendance\/my\/records\?from=/);
  assert.match(source, /Select subject and class date/);
  assert.match(source, /Request pending/);
});

test('subject and student reports send every required API filter', () => {
  assert.match(source, /attendance\/subject\/\$\{subjectId\}\?from=\$\{from\}&to=\$\{to\}/);
  assert.match(
    source,
    /attendance\/student\/\$\{studentId\}\/summary\?semester=\$\{semester\}&academicYear=\$\{academicYear\}/,
  );
  assert.match(source, /Export CSV/);
  assert.match(source, /Export sessions/);
});

test('correction reviewers can approve and reject requests', () => {
  assert.match(source, /correction\/\$\{idx\}\/approve/);
  assert.match(source, /correction\/\$\{idx\}\/reject/);
  assert.match(source, /show: \(isAnalytics \|\| isHod\) && canApprove/);
  assert.match(source, /useHasPermission\('student_attendance', 'approve'\)/);
});

test('attendance tabs and destructive operations follow permissions and active role scope', () => {
  assert.match(source, /const canMark = isFaculty && canCreate/);
  assert.match(source, /show: \(isAnalytics \|\| isHod\) && canView/);
  assert.match(source, /canLockInstitutionAttendance/);
  assert.match(source, /showCorrectionModal && canRequestCorrection/);
  assert.match(source, /const resolvedActive = tabs\.some\(\(tab\) => tab\.id === active\)/);
});
