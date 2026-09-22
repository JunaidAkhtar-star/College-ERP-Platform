const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const page = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/timetable/components/TimetablePage.tsx',
  ),
  'utf8',
);
const modal = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/timetable/components/TimetableModal.tsx',
  ),
  'utf8',
);
const printView = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src/features/role-wise-features/timetable/components/TimetablePrintView.tsx',
  ),
  'utf8',
);
const globalStyles = fs.readFileSync(path.join(__dirname, '..', 'src/app/globals.css'), 'utf8');

test('timetable capabilities follow active role and permission actions', () => {
  assert.match(
    page,
    /state\.activeRole\?\.baseRole \?\? state\.activeRole\?\.name \?\? state\.role/,
  );
  assert.match(page, /useHasPermission\('timetable', 'view'\)/);
  assert.match(page, /useHasPermission\('timetable', 'edit'\)/);
  assert.match(page, /useHasPermission\('timetable', 'approve'\)/);
  assert.doesNotMatch(page, /useHasAnyRole|useHasRole/);
});

test('read-only roles cannot invoke grid or card mutations', () => {
  assert.match(page, /onAddSlot=\{canManage \? handleAddSlotFromGrid : undefined\}/);
  assert.match(page, /onEditSlot=\{canManage \? handleEditSlotFromGrid : undefined\}/);
  assert.match(page, /\{canManage && !t\.isApproved && t\.isActive && \(/);
  assert.match(page, /\{canApprove && !t\.isApproved && t\.isActive && \(/);
});

test('publishing uses a dedicated publication-details dialog', () => {
  assert.match(page, /PublishTimetableModal/);
  assert.match(page, /timetable\/\$\{timetable\._id\}\/publication-details/);
  assert.match(page, /timetable\/\$\{timetable\._id\}\/validate-publish/);
  assert.match(page, /timetable\/\$\{timetable\._id\}\/approve/);
  assert.doesNotMatch(page, /Master View/);
});

test('published timetables expose governed extra classes and replacement history', () => {
  assert.match(page, /Extra classes & replacements/);
  assert.match(page, /ClassOperationsModal/);
  assert.match(page, /timetable\/\$\{timetable\._id\}\/class-operations/);
  assert.match(page, /timetable\/\$\{timetable\._id\}\/extra-class/);
  assert.match(page, /Cancel replacement/);
});

test('timetable page has explicit denied and request failure states', () => {
  assert.match(page, /Timetable access unavailable/);
  assert.match(page, /Timetable could not be loaded/);
  assert.match(page, /Try again/);
});

test('timetables inherit their selected scope and support publication metadata', () => {
  assert.match(modal, /Break \/ lunch/);
  assert.match(modal, /Activity \/ seminar \/ sports/);
  assert.match(modal, /belongs to the selected timetable scope/);
  assert.doesNotMatch(modal, /label="Branch lanes"/);
  assert.match(modal, /Effective from/);
});

test('Dean creation uses a dynamic multi-section academic planner', () => {
  assert.match(modal, /type="academicYears"/);
  assert.match(modal, /type="programs"/);
  assert.match(modal, /label="Departments \/ Branches"/);
  assert.match(modal, /label="Sections"/);
  assert.match(modal, /multiple/);
  assert.match(modal, /timetable\/batch/);
  assert.match(modal, /useHasPermission\('academic_structure', 'create'\)/);
  assert.match(modal, /Whole cohort \(no sections\)/);
  assert.match(modal, /directScopes/);
  assert.match(modal, /type="curricula"/);
});

test('official print view preserves branch rows and merged time blocks', () => {
  assert.match(page, /Print Preview/);
  assert.match(printView, /colSpan=\{colSpan\}/);
  assert.match(printView, /rowSpan=\{branches\.length\}/);
  assert.match(globalStyles, /size: A4 landscape/);
  assert.match(printView, /assignmentDetails/);
  assert.match(printView, /Assignment details are listed\s+above/);
  assert.match(printView, /facultyShortCode/);
  assert.match(printView, /institution-setting\/public/);
  assert.match(printView, /With effect from:/);
  assert.match(printView, /Session:/);
  assert.match(printView, /disabled=\{institutionLoading \|\| !printReady\}/);
});
