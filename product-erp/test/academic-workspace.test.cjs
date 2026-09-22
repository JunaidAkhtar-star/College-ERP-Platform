const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const academicPages = [
  'curriculum/components/CurriculumPage.tsx',
  'departments/components/DepartmentsPage.tsx',
  'subjects/components/SubjectsPage.tsx',
  'academic-structure/components/AcademicStructurePage.tsx',
  'academic-calendar/components/AcademicCalendarPage.tsx',
  'timetable/components/TimetablePage.tsx',
  'lesson-plan/components/LessonPlanPage.tsx',
  'course-progress/components/CourseProgressPage.tsx',
  'semester-registration/components/SemesterRegistrationPage.tsx',
].map((file) => `src/features/role-wise-features/${file}`);

test('every Academic page exposes the shared role-aware workspace journey', () => {
  for (const file of academicPages) {
    const source = read(file);
    assert.match(source, /AcademicWorkflowBar/, `${file} must use AcademicWorkflowBar`);
  }
});

test('Academic forms never ask users for backend database identifiers', () => {
  const source = academicPages.map(read).join('\n');
  for (const forbidden of [
    'MongoDB ObjectId',
    'Department ID',
    'Faculty ID',
    'User ID',
    'Substitute Faculty User ID',
    'window.prompt',
  ]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace('.', '\\.')));
  }
});

test('governed Academic workflows use their authoritative routes and inputs', () => {
  const timetable = read('src/features/role-wise-features/timetable/components/TimetablePage.tsx');
  assert.match(timetable, /timetable\/\$\{timetable\._id\}\/approve/);
  assert.match(timetable, /sectionId: string/);
  assert.match(timetable, /periodTimings:/);
  assert.match(timetable, /periodsPerWeek:/);
  assert.match(timetable, /No database IDs are required/);

  const registration = read(
    'src/features/role-wise-features/semester-registration/components/SemesterRegistrationPage.tsx',
  );
  assert.match(registration, /semester-registration\/context/);
  assert.doesNotMatch(registration, /getFieldProps\('rollNumber'\)/);
  assert.doesNotMatch(registration, /getFieldProps\('studentName'\)/);

  const progress = read(
    'src/features/role-wise-features/course-progress/components/CourseProgressPage.tsx',
  );
  assert.match(progress, /Progress starts from an approved lesson plan/);
  assert.doesNotMatch(progress, />\s*New Record\s*</);

  const lessonPlan = read(
    'src/features/role-wise-features/lesson-plan/components/LessonPlanPage.tsx',
  );
  assert.match(lessonPlan, /Create lesson-plan draft/);
  assert.match(lessonPlan, /plannedTopics/);
  assert.match(lessonPlan, /coMappings/);
});

test('Academic data views use one search control and the shared empty state', () => {
  const dataView = read('src/shared/core/DataViewSwitcher.tsx');
  const table = read('src/shared/core/CustomTable.tsx');
  assert.match(dataView, /import Empty from '@\/shared\/core\/Empty'/);
  assert.match(table, /import Empty from '@\/shared\/core\/Empty'/);

  for (const file of [
    'src/features/role-wise-features/curriculum/components/CurriculumPage.tsx',
    'src/features/role-wise-features/departments/components/DepartmentsPage.tsx',
    'src/features/role-wise-features/subjects/components/SubjectsPage.tsx',
    'src/features/role-wise-features/timetable/components/TimetablePage.tsx',
  ]) {
    assert.doesNotMatch(read(file), /options=\{\{ search: true/);
  }
});

test('Section semesters are constrained by the selected batch curriculum', () => {
  const structure = read(
    'src/features/role-wise-features/academic-structure/components/AcademicStructurePage.tsx',
  );
  assert.match(structure, /selectedSectionBatch/);
  assert.match(structure, /curriculum\.totalSemesters/);
  assert.match(structure, /Select an available semester/);
  assert.match(structure, /Available semesters come directly from its curriculum/);
  assert.match(structure, /function SelectField/);
});

test('Batch and allotment workspaces explain lifecycle and use status colors', () => {
  const structure = read(
    'src/features/role-wise-features/academic-structure/components/AcademicStructurePage.tsx',
  );
  assert.match(structure, /New batches\s+start as Planned/);
  assert.match(structure, /add semester-wise sections from\s+the Sections tab/);
  assert.match(structure, /Capacity and duplicate\s+allotment rules are checked automatically/);
  assert.match(structure, /function statusTone/);
  assert.match(structure, /bg-emerald-50 text-emerald-700/);
});

test('Allotments support validated automatic strategies and retain manual placement', () => {
  const structure = read(
    'src/features/role-wise-features/academic-structure/components/AcademicStructurePage.tsx',
  );
  assert.match(structure, /Automatic Allotment/);
  assert.match(structure, /Fill sections in order/);
  assert.match(structure, /Balanced distribution/);
  assert.match(structure, /Merit-rank order/);
  assert.match(structure, /student-section-allotment\/bulk\/preview/);
  assert.match(structure, /student-section-allotment\/bulk\/execute/);
  assert.match(structure, /Approve & Publish Allotment/);
  assert.match(structure, /Preview only · Academic approval required/);
  assert.match(structure, /Allot Student/);
  assert.match(structure, /never creates Section A, B or C/);
  assert.match(structure, /fixed inset-0 z-50/);
  assert.match(structure, /Destination Section/);
  assert.match(structure, /Confirm Transfer/);
  assert.match(structure, /grid items-stretch gap-5 lg:grid-cols-2/);
  assert.match(structure, /Use this for one student at a time/);
  assert.equal((structure.match(/className="mt-auto"/g) ?? []).length, 2);
});

test('Academic structure separates institutional and department authority', () => {
  const structure = read(
    'src/features/role-wise-features/academic-structure/components/AcademicStructurePage.tsx',
  );
  assert.match(structure, /useHasPermission\('batch_management', 'create'\)/);
  assert.match(structure, /useHasPermission\('section_management', 'approve'\)/);
  assert.match(structure, /useHasPermission\('student_allotment', 'edit'\)/);
  assert.match(structure, /Batches are governed by Academic Administration/);
  assert.match(structure, /role="tooltip"/);
  assert.match(structure, /New\s+sections remain Planned[\s\S]*?until Dean Academic/);
  assert.match(structure, /section\/\$\{row\._id\}\/approve/);
  assert.match(structure, /activeRole === 'hod'/);
  assert.match(structure, /departmentLocked=\{isDepartmentHod\}/);
  assert.match(structure, /!departmentLocked &&/);
  assert.doesNotMatch(structure, /Fixed for your HOD role/);
});
