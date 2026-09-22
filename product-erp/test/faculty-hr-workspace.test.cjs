const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Faculty and HR pages expose one shared role-aware workspace', () => {
  for (const file of [
    'src/features/role-wise-features/faculty-profile/components/FacultyProfilePage.tsx',
    'src/features/role-wise-features/faculty-profile/components/FacultyOnboardPage.tsx',
    'src/features/role-wise-features/faculty-workload/components/FacultyWorkloadPage.tsx',
    'src/features/role-wise-features/hr/components/HrPage.tsx',
    'src/features/role-wise-features/faculty-attendance/components/FacultyAttendancePage.tsx',
    'src/features/role-wise-features/leave/components/LeavePage.tsx',
    'src/features/role-wise-features/payroll/components/PayrollPage.tsx',
  ]) {
    assert.match(read(file), /FacultyHrWorkflowBar/);
  }
});

test('HR onboarding uses real user and department selectors', () => {
  const source = read('src/features/role-wise-features/hr/components/HrPage.tsx');
  assert.match(source, /type="users"/);
  assert.match(source, /type="departments"/);
  assert.match(source, /userId: Yup\.string\(\)\.required/);
  assert.match(source, /department: Yup\.string\(\)\.required/);
  assert.match(source, /Onboard Teaching Faculty/);
  assert.match(source, /Add Non-Teaching Staff/);
  assert.match(source, /\/\$\{tenant\}\/\$\{role\}\/faculty-management\/onboard/);
});

test('Teaching staff has one clearly named guided onboarding entry', () => {
  const form = read('src/features/role-wise-features/faculty-profile/components/FacultyForm.tsx');
  const list = read(
    'src/features/role-wise-features/faculty-profile/components/FacultyProfilePage.tsx',
  );
  assert.match(form, /Guided onboarding/);
  assert.match(form, /Create the login, employment assignment and academic profile in one flow/);
  assert.match(list, /Add New Faculty/);
});

test('Faculty workload uses dynamic linked entities and the approval endpoint', () => {
  const source = read(
    'src/features/role-wise-features/faculty-workload/components/FacultyWorkloadPage.tsx',
  );
  for (const selector of ['departments', 'faculty', 'academicYears', 'subjects']) {
    assert.match(source, new RegExp(`type="${selector}"`));
  }
  assert.match(source, /faculty-workload\/\$\{w\._id\}\/approve/);
  assert.match(source, /method: 'POST'/);
  assert.doesNotMatch(source, /Faculty ID|Department ID/);
});

test('Attendance, leave and payroll use backend-compatible contracts', () => {
  const attendance = read(
    'src/features/role-wise-features/faculty-attendance/components/FacultyAttendancePage.tsx',
  );
  const attendanceTypes = read(
    'src/features/role-wise-features/faculty-attendance/types/faculty-attendance.types.ts',
  );
  const leave = read('src/features/role-wise-features/leave/components/LeavePage.tsx');
  const payroll = read('src/features/role-wise-features/payroll/components/PayrollPage.tsx');

  assert.match(attendanceTypes, /'on_leave'/);
  assert.match(attendanceTypes, /'late'/);
  assert.doesNotMatch(attendanceTypes, /'on_duty'|'leave'/);
  assert.match(attendance, /q\.set\('startDate'/);
  assert.match(attendance, /q\.set\('endDate'/);
  assert.match(attendance, /RecordsDateRangePicker/);
  assert.match(attendance, /FacultyDailyRoster/);
  assert.match(attendance, /singleDate/);
  assert.match(attendance, /Update faculty attendance/);
  assert.match(attendance, /Submit faculty attendance/);
  assert.doesNotMatch(attendance, /CustomTable/);
  assert.doesNotMatch(attendance, /MarkAttendanceModal/);
  assert.match(attendance, /q\.set\('departmentId'/);
  assert.doesNotMatch(attendance, /data\?\.data/);
  assert.match(attendance, /typeof record\.facultyId === 'string'/);
  assert.match(leave, /'loss_of_pay'/);
  assert.doesNotMatch(leave, /'lop'/);
  assert.match(payroll, /payroll\/generate-monthly/);
  assert.match(payroll, /downloadPdf/);
  assert.doesNotMatch(payroll, /form16\?token=/);
});

test('Server-backed Faculty table does not render a second search input', () => {
  const source = read(
    'src/features/role-wise-features/faculty-profile/components/FacultyProfilePage.tsx',
  );
  assert.match(source, /showSearch=\{false\}/);
  assert.match(source, /options=\{\{[\s\S]*?search: false/);
});
